/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Case,
  CaseApproval,
  CaseDraft,
  CaseEvent,
  CaseExtractedState,
  CaseMessage,
  CaseStatus,
} from './types';

/**
 * Valid transitions map for Case lifecycle.
 */
export const VALID_CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DETECTED: ['DRAFT_READY', 'FAILED'],
  DRAFT_READY: ['WAITING_APPROVAL', 'FAILED'],
  WAITING_APPROVAL: ['SENT', 'DRAFT_READY', 'FAILED'],
  SENT: ['WAITING_REPLY', 'FAILED'],
  WAITING_REPLY: ['REPLY_RECEIVED', 'FAILED'],
  REPLY_RECEIVED: ['NEEDS_DECISION', 'RESOLVED', 'FAILED'],
  NEEDS_DECISION: ['RESOLVED', 'WAITING_REPLY', 'FAILED'],
  RESOLVED: [],
  FAILED: ['DRAFT_READY'], // Allow recovery
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return VALID_CASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function createCaseEvent(
  caseId: string,
  type: CaseEvent['type'],
  summary: string,
  payload?: Record<string, any>,
  isReal: boolean = true
): CaseEvent {
  return {
    id: `cevt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    caseId,
    type,
    timestamp: new Date().toISOString(),
    summary,
    payload,
    isReal,
  };
}

export function createInitialSupplierCase(params: {
  id?: string;
  poNumber?: string;
  objective?: string;
  contactEmail?: string;
  contactName?: string;
  isReal?: boolean;
}): Case {
  const caseId = params.id || `case-${Date.now()}`;
  const now = new Date().toISOString();

  const initialEvent = createCaseEvent(
    caseId,
    'CASE_CREATED',
    `Supplier exception case created for PO #${params.poNumber || '511'}`,
    { poNumber: params.poNumber || '511' },
    params.isReal ?? true
  );

  return {
    id: caseId,
    type: 'SUPPLIER_EXCEPTION',
    organizationId: 'my-company',
    counterpartyId: 'acme-manufacturing',
    status: 'DRAFT_READY',
    poNumber: params.poNumber || '511',
    objective:
      params.objective ||
      'Inquire with Acme Manufacturing regarding delayed PO #511 chassis shipment and obtain confirmed delivery ETA and reason.',
    contact: {
      name: params.contactName || 'Acme Fabrication Support',
      email: params.contactEmail || '',
      organizationName: 'Acme Manufacturing',
      organizationId: 'acme-manufacturing',
    },
    communicationRail: 'GMAIL',
    draft: {
      recipient: params.contactEmail || '',
      subject: `PO #${params.poNumber || '511'} — Confirmed ETA & Customs Hold Status Required`,
      body: `Hi,\n\nWe noticed shipment for PO #${params.poNumber || '511'} is currently on hold. Could you please provide the reason for delay and your confirmed ETA for delivery to our assembly facility?\n\nThank you,\nMaya · AI Procurement Lead`,
      generatedByAi: true,
    },
    messages: [],
    events: [initialEvent],
    approvals: [],
    isReal: params.isReal ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Pure transition: update draft
 */
export function transitionToWaitingApproval(
  currentCase: Case,
  draft: CaseDraft
): { nextCase: Case; event: CaseEvent } {
  const event = createCaseEvent(
    currentCase.id,
    'DRAFT_GENERATED',
    `Supplier inquiry draft prepared for ${draft.recipient}`,
    { recipient: draft.recipient, subject: draft.subject },
    currentCase.isReal
  );

  return {
    nextCase: {
      ...currentCase,
      draft,
      status: 'WAITING_APPROVAL',
      contact: {
        ...currentCase.contact,
        email: draft.recipient,
      },
      events: [event, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event,
  };
}

/**
 * Pure transition: mark sent (with idempotency guard)
 */
export function transitionToSent(
  currentCase: Case,
  outbound: {
    messageId: string;
    threadId: string;
    approvedBy: string;
    recipient: string;
    subject: string;
    body: string;
  }
): { success: boolean; nextCase: Case; event?: CaseEvent; reason?: string } {
  // Idempotency: cannot send twice
  if (currentCase.status === 'SENT' || currentCase.status === 'WAITING_REPLY') {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'EMAIL_ALREADY_SENT',
    };
  }

  const approval: CaseApproval = {
    id: `appr-${Date.now()}`,
    type: 'SEND_EMAIL',
    approvedBy: outbound.approvedBy,
    approvedAt: new Date().toISOString(),
  };

  const sentMessage: CaseMessage = {
    id: `msg-${Date.now()}`,
    role: 'AGENT',
    authorName: 'Maya (AI Procurement Lead)',
    email: outbound.approvedBy,
    subject: outbound.subject,
    body: outbound.body,
    timestamp: new Date().toISOString(),
    externalMessageId: outbound.messageId,
  };

  const approvalEvent = createCaseEvent(
    currentCase.id,
    'SEND_APPROVED',
    `Outbound supplier email approved by ${outbound.approvedBy}`,
    { recipient: outbound.recipient },
    currentCase.isReal
  );

  const sentEvent = createCaseEvent(
    currentCase.id,
    'EMAIL_SENT',
    `Real Gmail message sent to ${outbound.recipient}`,
    { messageId: outbound.messageId, threadId: outbound.threadId },
    currentCase.isReal
  );

  return {
    success: true,
    nextCase: {
      ...currentCase,
      status: 'WAITING_REPLY',
      externalMessageId: outbound.messageId,
      externalThreadId: outbound.threadId,
      messages: [sentMessage, ...currentCase.messages],
      approvals: [approval, ...currentCase.approvals],
      events: [sentEvent, approvalEvent, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event: sentEvent,
  };
}

/**
 * Pure transition: record reply and extracted state (idempotent by externalMessageId)
 */
export function transitionToReplyReceived(
  currentCase: Case,
  inbound: {
    messageId: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    body: string;
    extracted: CaseExtractedState;
  }
): { success: boolean; nextCase: Case; events: CaseEvent[]; reason?: string } {
  // Idempotency: verify this externalMessageId hasn't already been processed
  const alreadyProcessed = currentCase.messages.some(
    (m) => m.externalMessageId === inbound.messageId
  );
  if (alreadyProcessed) {
    return {
      success: false,
      nextCase: currentCase,
      events: [],
      reason: 'MESSAGE_ALREADY_PROCESSED',
    };
  }

  const replyMessage: CaseMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'COUNTERPARTY',
    authorName: inbound.fromName || inbound.fromEmail,
    email: inbound.fromEmail,
    subject: inbound.subject,
    body: inbound.body,
    timestamp: new Date().toISOString(),
    externalMessageId: inbound.messageId,
  };

  const replyEvent = createCaseEvent(
    currentCase.id,
    'SUPPLIER_REPLY_RECEIVED',
    `Supplier reply received from ${inbound.fromEmail}`,
    { messageId: inbound.messageId, snippet: inbound.body.slice(0, 100) },
    currentCase.isReal
  );

  const parsedEvent = createCaseEvent(
    currentCase.id,
    'REPLY_PARSED',
    `Parsed structured facts: ETA ${inbound.extracted.confirmedEta || 'Unknown'}, Reason: ${inbound.extracted.delayReason || 'None'}`,
    { extracted: inbound.extracted },
    currentCase.isReal
  );

  const generatedEvents: CaseEvent[] = [parsedEvent, replyEvent];

  if (inbound.extracted.securityFlags && inbound.extracted.securityFlags.length > 0) {
    const flagEvent = createCaseEvent(
      currentCase.id,
      'SECURITY_FLAG_RAISED',
      `Security flag: ${inbound.extracted.securityFlags[0]}`,
      { flags: inbound.extracted.securityFlags },
      currentCase.isReal
    );
    generatedEvents.unshift(flagEvent);
  }

  const decisionEvent = createCaseEvent(
    currentCase.id,
    'DECISION_REQUIRED',
    `Human decision required on supplier terms`,
    undefined,
    currentCase.isReal
  );
  generatedEvents.unshift(decisionEvent);

  return {
    success: true,
    nextCase: {
      ...currentCase,
      status: 'NEEDS_DECISION',
      messages: [replyMessage, ...currentCase.messages],
      events: [...generatedEvents, ...currentCase.events],
      extractedState: inbound.extracted,
      updatedAt: new Date().toISOString(),
    },
    events: generatedEvents,
  };
}

/**
 * Pure transition: resolve case (e.g. credit accepted)
 */
export function transitionToResolved(
  currentCase: Case,
  resolution: {
    approvedBy: string;
    acceptedCredit?: number;
    notes?: string;
  }
): { success: boolean; nextCase: Case; event?: CaseEvent; reason?: string } {
  if (currentCase.status === 'RESOLVED') {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'ALREADY_RESOLVED',
    };
  }

  const approval: CaseApproval = {
    id: `appr-${Date.now()}`,
    type: 'ACCEPT_CREDIT',
    approvedBy: resolution.approvedBy,
    approvedAt: new Date().toISOString(),
    comments: resolution.notes,
  };

  const resolveEvent = createCaseEvent(
    currentCase.id,
    'CASE_RESOLVED',
    resolution.acceptedCredit
      ? `Case resolved: Founder accepted $${resolution.acceptedCredit.toFixed(2)} supplier credit`
      : `Case resolved by ${resolution.approvedBy}`,
    { acceptedCredit: resolution.acceptedCredit },
    currentCase.isReal
  );

  return {
    success: true,
    nextCase: {
      ...currentCase,
      status: 'RESOLVED',
      approvals: [approval, ...currentCase.approvals],
      events: [resolveEvent, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event: resolveEvent,
  };
}
