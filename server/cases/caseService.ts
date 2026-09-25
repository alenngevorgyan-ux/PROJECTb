/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case, CaseDraft } from '../../src/domain/case/types';
import {
  createInitialSupplierCase,
  transitionToWaitingApproval,
  transitionToSent,
  transitionToReplyReceived,
  transitionToResolved,
} from '../../src/domain/case/stateTransitions';
import { caseRepository } from './caseRepository';
import { ActionPolicy } from '../policy/actionPolicy';
import { generateSupplierDraft } from '../ai/supplierEmailDraft';
import { parseSupplierReply } from '../ai/supplierReplyParser';
import { GmailClient } from '../gmail/gmailClient';

export class CaseService {
  /**
   * Retrieves the active supplier case or creates one if none exists.
   */
  public getActiveCase(): Case {
    return caseRepository.getActiveCase();
  }

  /**
   * Retrieves all cases.
   */
  public getAllCases(): Case[] {
    return caseRepository.getAll();
  }

  /**
   * Retrieves a case by ID.
   */
  public getCaseById(id: string): Case | undefined {
    return caseRepository.getById(id);
  }

  /**
   * Creates a new supplier case.
   */
  public createSupplierCase(params: {
    poNumber?: string;
    contactEmail?: string;
    contactName?: string;
    objective?: string;
  }): Case {
    const newCase = createInitialSupplierCase({
      poNumber: params.poNumber || '511',
      contactEmail: params.contactEmail,
      contactName: params.contactName,
      objective: params.objective,
      isReal: true,
    });
    return caseRepository.save(newCase);
  }

  /**
   * Prepares or updates a supplier email draft using Gemini.
   */
  public async prepareDraft(
    caseId: string,
    params?: { recipient?: string; subject?: string; body?: string }
  ): Promise<Case> {
    const currentCase = caseRepository.getById(caseId) || caseRepository.getActiveCase();

    let draftContent: CaseDraft;
    if (params?.subject && params?.body && params?.recipient) {
      draftContent = {
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        generatedByAi: false,
      };
    } else {
      const recipient = params?.recipient || currentCase.contact.email || '';
      const aiDraft = await generateSupplierDraft({
        poNumber: currentCase.poNumber,
        objective: currentCase.objective,
        counterpartyName: currentCase.contact.organizationName,
        contactName: currentCase.contact.name,
        contactEmail: recipient,
      });

      draftContent = {
        recipient,
        subject: params?.subject || aiDraft.subject,
        body: params?.body || aiDraft.body,
        generatedByAi: true,
      };
    }

    const { nextCase } = transitionToWaitingApproval(currentCase, draftContent);
    return caseRepository.save(nextCase);
  }

  /**
   * Approves and sends the real outbound email via Gmail.
   * Enforces human approval policy and strict idempotency.
   */
  public async approveAndSend(params: {
    caseId: string;
    accessToken: string;
    approvedBy: string;
    recipient: string;
    subject: string;
    body: string;
  }): Promise<{ success: boolean; case: Case; reason?: string }> {
    const { caseId, accessToken, approvedBy, recipient, subject, body } = params;

    const currentCase = caseRepository.getById(caseId);
    if (!currentCase) {
      return {
        success: false,
        case: caseRepository.getActiveCase(),
        reason: 'CASE_NOT_FOUND',
      };
    }

    // 1. Policy check: must have explicit human approval
    const policy = ActionPolicy.canSendEmail(true);
    if (!policy.allowed) {
      return { success: false, case: currentCase, reason: policy.reason };
    }

    // 2. Strict Recipient Safety Check: forbid sending to demo dummy domains
    if (!recipient || recipient.endsWith('.internal')) {
      return {
        success: false,
        case: currentCase,
        reason: 'INVALID_RECIPIENT: Real Supplier Mode requires a valid non-internal email address.',
      };
    }

    // 3. Idempotency Check: cannot send twice
    if (currentCase.status === 'SENT' || currentCase.status === 'WAITING_REPLY') {
      return {
        success: false,
        case: currentCase,
        reason: 'EMAIL_ALREADY_SENT',
      };
    }

    // 4. Send via official Gmail API
    let sendResult: { messageId: string; threadId: string };
    try {
      sendResult = await GmailClient.sendEmail({
        accessToken,
        to: recipient,
        subject,
        body,
        threadId: currentCase.externalThreadId,
      });
    } catch (err: any) {
      console.error('Failed to send email via Gmail API:', err);
      return {
        success: false,
        case: currentCase,
        reason: err.message || 'GMAIL_SEND_FAILED',
      };
    }

    // 5. State transition & persistence
    const transition = transitionToSent(currentCase, {
      messageId: sendResult.messageId,
      threadId: sendResult.threadId,
      approvedBy,
      recipient,
      subject,
      body,
    });

    if (!transition.success) {
      return { success: false, case: currentCase, reason: transition.reason };
    }

    const saved = caseRepository.save(transition.nextCase);
    return { success: true, case: saved };
  }

  /**
   * Synchronizes the Gmail thread to retrieve real supplier responses.
   * Parses new responses using Gemini structured extraction.
   * Completely idempotent: duplicate messages are not reprocessed.
   */
  public async syncThreadReplies(params: {
    caseId: string;
    accessToken: string;
    userEmail: string;
  }): Promise<{
    success: boolean;
    case: Case;
    newRepliesCount: number;
    reason?: string;
  }> {
    const { caseId, accessToken, userEmail } = params;

    const currentCase = caseRepository.getById(caseId);
    if (!currentCase) {
      return {
        success: false,
        case: caseRepository.getActiveCase(),
        newRepliesCount: 0,
        reason: 'CASE_NOT_FOUND',
      };
    }

    if (!currentCase.externalThreadId) {
      return {
        success: false,
        case: currentCase,
        newRepliesCount: 0,
        reason: 'NO_EXTERNAL_THREAD: Case has not dispatched an email yet.',
      };
    }

    // 1. Fetch thread messages from Gmail
    let thread: { id: string; messages: any[] };
    try {
      thread = await GmailClient.getThread({
        accessToken,
        threadId: currentCase.externalThreadId,
      });
    } catch (err: any) {
      console.error('Failed to sync thread from Gmail:', err);
      return {
        success: false,
        case: currentCase,
        newRepliesCount: 0,
        reason: err.message || 'GMAIL_THREAD_FETCH_FAILED',
      };
    }

    // 2. Identify new messages from counterparty (not sent by our user)
    const existingMessageIds = new Set(
      currentCase.messages.map((m) => m.externalMessageId).filter(Boolean)
    );

    const newMessages = thread.messages.filter((msg) => {
      // Skip already processed
      if (existingMessageIds.has(msg.id)) return false;
      // Skip messages sent from the current user
      const fromLower = msg.from.toLowerCase();
      if (userEmail && fromLower.includes(userEmail.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (newMessages.length === 0) {
      return {
        success: true,
        case: currentCase,
        newRepliesCount: 0,
      };
    }

    // 3. Process new counterparty message(s)
    let workingCase = currentCase;
    for (const msg of newMessages) {
      // Parse with Gemini structured extraction + fraud scan
      const extracted = await parseSupplierReply(msg.body);

      const res = transitionToReplyReceived(workingCase, {
        messageId: msg.id,
        fromEmail: msg.from,
        fromName: msg.from.split('<')[0].replace(/"/g, '').trim(),
        subject: msg.subject,
        body: msg.body,
        extracted,
      });

      if (res.success) {
        workingCase = res.nextCase;
      }
    }

    const saved = caseRepository.save(workingCase);
    return {
      success: true,
      case: saved,
      newRepliesCount: newMessages.length,
    };
  }

  /**
   * Accepts supplier credit or resolves the case.
   */
  public acceptCredit(params: {
    caseId: string;
    approvedBy: string;
    acceptedCredit?: number;
    notes?: string;
  }): { success: boolean; case: Case; reason?: string } {
    const { caseId, approvedBy, acceptedCredit, notes } = params;

    const currentCase = caseRepository.getById(caseId);
    if (!currentCase) {
      return {
        success: false,
        case: caseRepository.getActiveCase(),
        reason: 'CASE_NOT_FOUND',
      };
    }

    const policy = ActionPolicy.canAcceptCredit(true);
    if (!policy.allowed) {
      return { success: false, case: currentCase, reason: policy.reason };
    }

    const res = transitionToResolved(currentCase, {
      approvedBy,
      acceptedCredit,
      notes,
    });

    if (!res.success) {
      return { success: false, case: currentCase, reason: res.reason };
    }

    const saved = caseRepository.save(res.nextCase);
    return { success: true, case: saved };
  }

  /**
   * Resets the real cases repository to the default initial state.
   */
  public resetCases(): Case {
    return caseRepository.reset();
  }
}

export const caseService = new CaseService();
