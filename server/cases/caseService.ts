/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case, CaseDraft } from '../../src/domain/case/types';
import {
  createInitialSupplierCase,
  transitionToWaitingApproval,
  recordDraftApproval,
  transitionToSent,
  transitionToReplyReceived,
  transitionToUnverifiedSender,
  transitionToResolved,
} from '../../src/domain/case/stateTransitions';
import { caseRepository as defaultCaseRepository, CaseRepository } from './caseRepository';
import { ActionPolicy } from '../policy/actionPolicy';
import { generateSupplierDraft } from '../ai/supplierEmailDraft';
import { parseSupplierReply } from '../ai/supplierReplyParser';
import { GmailClient } from '../gmail/gmailClient';

/** Extracts a bare email address out of an RFC-2822 "Name <email>" header value. */
function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

export class CaseService {
  private readonly repository: CaseRepository;
  /**
   * In-process send locks, keyed by caseId. Node.js executes this module's
   * synchronous code to the first `await` without interleaving, so setting
   * a lock before any await guarantees a second concurrent call to
   * approveAndSend for the same Case observes the lock and is rejected
   * before either request has sent anything.
   */
  private readonly sendingLocks: Set<string> = new Set();

  constructor(repository: CaseRepository = defaultCaseRepository) {
    this.repository = repository;
  }

  public getActiveCase(): Case {
    return this.repository.getActiveCase();
  }

  public getAllCases(): Case[] {
    return this.repository.getAll();
  }

  public getCaseById(id: string): Case | undefined {
    return this.repository.getById(id);
  }

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
    return this.repository.save(newCase);
  }

  /**
   * Prepares or updates a supplier email draft using Gemini. Every call
   * bumps the Case's draftVersion and clears any pendingApproval bound to
   * an earlier version (see transitionToWaitingApproval), so an approval
   * granted before an edit can never be reused to send the edited draft.
   */
  public async prepareDraft(
    caseId: string,
    params?: { recipient?: string; subject?: string; body?: string }
  ): Promise<Case> {
    const currentCase = this.repository.getById(caseId) || this.repository.getActiveCase();

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
    return this.repository.save(nextCase);
  }

  /**
   * Records a human approval bound to the exact draft content, then sends
   * the real outbound email via Gmail. Protected by:
   *  - an in-process send lock so two concurrent requests for the same
   *    Case cannot both proceed to a Gmail send;
   *  - a persisted, content-bound approval (recordDraftApproval /
   *    transitionToSent) instead of a blind boolean policy check;
   *  - the existing SENT/WAITING_REPLY idempotency guard for sequential
   *    duplicate requests (e.g. a retried request after the lock clears).
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

    if (this.sendingLocks.has(caseId)) {
      const existing = this.repository.getById(caseId) || this.repository.getActiveCase();
      return { success: false, case: existing, reason: 'SEND_IN_PROGRESS: another send request for this Case is already running.' };
    }
    this.sendingLocks.add(caseId);

    try {
      const currentCase = this.repository.getById(caseId);
      if (!currentCase) {
        return { success: false, case: this.repository.getActiveCase(), reason: 'CASE_NOT_FOUND' };
      }

      // Strict Recipient Safety Check: forbid sending to demo dummy domains
      if (!recipient || recipient.endsWith('.internal')) {
        return {
          success: false,
          case: currentCase,
          reason: 'INVALID_RECIPIENT: Real Supplier Mode requires a valid non-internal email address.',
        };
      }

      // Fast idempotency path: no need to touch Gmail at all for a case
      // that has already sent (covers a sequential duplicate request
      // arriving after the in-process lock above has already cleared).
      if (currentCase.status === 'SENT' || currentCase.status === 'WAITING_REPLY') {
        return { success: false, case: currentCase, reason: 'EMAIL_ALREADY_SENT' };
      }

      // 1. Record a real, content-bound approval as persisted Case state.
      const approvalResult = recordDraftApproval(currentCase, { approvedBy, recipient, subject, body });
      if (!approvalResult.success) {
        return { success: false, case: currentCase, reason: approvalResult.reason };
      }
      const approvedCase = this.repository.save(approvalResult.nextCase);

      // 2. Deterministic policy gate: the ONLY thing that can make this
      // `true` is a persisted, content-bound approval — never a hardcoded
      // literal.
      const policy = ActionPolicy.canSendEmail(Boolean(approvedCase.pendingApproval));
      if (!policy.allowed) {
        return { success: false, case: approvedCase, reason: policy.reason };
      }

      // 3. Send via official Gmail API.
      let sendResult: { messageId: string; threadId: string };
      try {
        sendResult = await GmailClient.sendEmail({
          accessToken,
          to: recipient,
          subject,
          body,
          threadId: approvedCase.externalThreadId,
        });
      } catch (err: any) {
        console.error('Failed to send email via Gmail API:', err);
        // Draft remains WAITING_APPROVAL with its approval intact — a
        // retry after fixing the underlying Gmail error can proceed.
        return { success: false, case: approvedCase, reason: err.message || 'GMAIL_SEND_FAILED' };
      }

      // 4. State transition & persistence.
      const transition = transitionToSent(approvedCase, {
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        approvedBy,
        recipient,
        subject,
        body,
      });

      if (!transition.success) {
        // Gmail confirmed the send but our domain guard rejected the
        // transition (should not happen given the lock above) — surface
        // loudly since the real email already went out.
        console.error(
          `CRITICAL: Gmail send succeeded (messageId=${sendResult.messageId}) but Case transition failed: ${transition.reason}`
        );
        return { success: false, case: approvedCase, reason: transition.reason };
      }

      const saved = this.repository.save(transition.nextCase);
      return { success: true, case: saved };
    } finally {
      this.sendingLocks.delete(caseId);
    }
  }

  /**
   * Synchronizes the Gmail thread to retrieve real supplier responses.
   * The connected mailbox identity is derived server-side from the OAuth
   * token via Gmail's own profile endpoint — a client-supplied "userEmail"
   * is never trusted for this purpose. Each new message's sender is
   * verified against the Case's known counterparty before any trusted
   * fact is updated from it; unverified senders are recorded for human
   * review only. Fully idempotent: duplicate messages are never reprocessed.
   */
  public async syncThreadReplies(params: {
    caseId: string;
    accessToken: string;
  }): Promise<{
    success: boolean;
    case: Case;
    newRepliesCount: number;
    reason?: string;
  }> {
    const { caseId, accessToken } = params;

    const currentCase = this.repository.getById(caseId);
    if (!currentCase) {
      return { success: false, case: this.repository.getActiveCase(), newRepliesCount: 0, reason: 'CASE_NOT_FOUND' };
    }

    if (!currentCase.externalThreadId) {
      return {
        success: false,
        case: currentCase,
        newRepliesCount: 0,
        reason: 'NO_EXTERNAL_THREAD: Case has not dispatched an email yet.',
      };
    }

    // Authenticated mailbox identity — never trust a client-supplied email.
    let authenticatedEmail: string;
    try {
      const profile = await GmailClient.getProfile(accessToken);
      authenticatedEmail = (profile.emailAddress || '').toLowerCase();
    } catch (err: any) {
      return {
        success: false,
        case: currentCase,
        newRepliesCount: 0,
        reason: err.message || 'GMAIL_AUTH_FAILED',
      };
    }

    let thread: { id: string; messages: any[] };
    try {
      thread = await GmailClient.getThread({ accessToken, threadId: currentCase.externalThreadId });
    } catch (err: any) {
      console.error('Failed to sync thread from Gmail:', err);
      return { success: false, case: currentCase, newRepliesCount: 0, reason: err.message || 'GMAIL_THREAD_FETCH_FAILED' };
    }

    const existingMessageIds = new Set(currentCase.messages.map((m) => m.externalMessageId).filter(Boolean));

    const newMessages = thread.messages.filter((msg) => {
      if (existingMessageIds.has(msg.id)) return false;
      const fromEmail = extractEmailAddress(msg.from || '');
      if (authenticatedEmail && fromEmail === authenticatedEmail) return false; // our own sent message
      return true;
    });

    if (newMessages.length === 0) {
      return { success: true, case: currentCase, newRepliesCount: 0 };
    }

    const allowedSenders = new Set(
      (currentCase.allowedCounterpartyEmails && currentCase.allowedCounterpartyEmails.length > 0
        ? currentCase.allowedCounterpartyEmails
        : [currentCase.contact.email]
      )
        .filter(Boolean)
        .map((e) => e.toLowerCase())
    );

    let workingCase = currentCase;
    for (const msg of newMessages) {
      const fromEmail = extractEmailAddress(msg.from || '');
      const fromName = (msg.from || '').split('<')[0].replace(/"/g, '').trim();
      const isVerified = allowedSenders.size === 0 ? true : allowedSenders.has(fromEmail);

      if (!isVerified) {
        const res = transitionToUnverifiedSender(workingCase, {
          messageId: msg.id,
          fromEmail,
          fromName,
          subject: msg.subject,
          body: msg.body,
        });
        if (res.success) workingCase = res.nextCase;
        continue;
      }

      const extracted = await parseSupplierReply(msg.body);
      const res = transitionToReplyReceived(workingCase, {
        messageId: msg.id,
        fromEmail,
        fromName,
        subject: msg.subject,
        body: msg.body,
        extracted,
      });
      if (res.success) workingCase = res.nextCase;
    }

    const saved = this.repository.save(workingCase);
    return { success: true, case: saved, newRepliesCount: newMessages.length };
  }

  /**
   * Accepts supplier credit or otherwise resolves the case. A Case in
   * SECURITY_REVIEW (a flagged financial instruction, e.g. new bank
   * details) refuses to resolve unless the caller explicitly acknowledges
   * the review — see transitionToResolved.
   */
  public acceptCredit(params: {
    caseId: string;
    approvedBy: string;
    acceptedCredit?: number;
    notes?: string;
    securityReviewAcknowledged?: boolean;
  }): { success: boolean; case: Case; reason?: string } {
    const { caseId, approvedBy, acceptedCredit, notes, securityReviewAcknowledged } = params;

    const currentCase = this.repository.getById(caseId);
    if (!currentCase) {
      return { success: false, case: this.repository.getActiveCase(), reason: 'CASE_NOT_FOUND' };
    }

    const policy = ActionPolicy.canAcceptCredit(true);
    if (!policy.allowed) {
      return { success: false, case: currentCase, reason: policy.reason };
    }

    const res = transitionToResolved(currentCase, { approvedBy, acceptedCredit, notes, securityReviewAcknowledged });
    if (!res.success) {
      return { success: false, case: currentCase, reason: res.reason };
    }

    const saved = this.repository.save(res.nextCase);
    return { success: true, case: saved };
  }

  /**
   * Resets the REAL cases repository to its default initial state. This is
   * deliberately a distinct code path from the demo-world reset
   * (WorldContext.resetDemo on the frontend) — resetting the visual demo
   * must never call this and must never delete real Case data. Intended
   * only for explicit, confirmed developer/test use.
   */
  public resetCases(): Case {
    return this.repository.reset();
  }
}

export const caseService = new CaseService();
