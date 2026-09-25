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
 * Valid transitions map for Case lifecycle. This is the single source of
 * truth for legal status changes — every transition function below must
 * check canTransitionCase() before mutating status, so business code
 * cannot bypass it by calling a transition function directly.
 */
export const VALID_CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DETECTED: ['DRAFT_READY', 'FAILED'],
  DRAFT_READY: ['WAITING_APPROVAL', 'FAILED'],
  WAITING_APPROVAL: ['WAITING_APPROVAL', 'SENT', 'WAITING_REPLY', 'FAILED'],
  SENT: ['WAITING_REPLY', 'FAILED'],
  WAITING_REPLY: ['REPLY_RECEIVED', 'NEEDS_DECISION', 'SECURITY_REVIEW', 'FAILED'],
  REPLY_RECEIVED: ['NEEDS_DECISION', 'SECURITY_REVIEW', 'RESOLVED', 'FAILED'],
  NEEDS_DECISION: ['RESOLVED', 'WAITING_REPLY', 'FAILED'],
  SECURITY_REVIEW: ['RESOLVED', 'WAITING_REPLY', 'FAILED'],
  RESOLVED: [],
  FAILED: ['DRAFT_READY'], // Allow recovery
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return VALID_CASE_TRANSITIONS[from]?.includes(to) ?? false;
}

function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransitionCase(from, to)) {
    throw new Error(`Illegal Case transition: ${from} -> ${to}`);
  }
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
  const caseId = params.id || `case-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    allowedCounterpartyEmails: params.contactEmail ? [params.contactEmail] : [],
    communicationRail: 'GMAIL',
    draft: {
      recipient: params.contactEmail || '',
      subject: `PO #${params.poNumber || '511'} — Status & Confirmed ETA Requested`,
      body: `Hi,\n\nWe noticed shipment for PO #${params.poNumber || '511'} is currently on hold. Could you please provide the reason for delay and your confirmed ETA for delivery?\n\nThank you,\nMaya · AI Procurement Lead`,
      generatedByAi: true,
    },
    draftVersion: 1,
    messages: [],
    events: [initialEvent],
    approvals: [],
    isReal: params.isReal ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Pure transition: update draft. Always invalidates any pending approval
 * bound to a previous draft version, and bumps draftVersion so an approval
 * recorded before this call can never satisfy transitionToSent afterward.
 */
export function transitionToWaitingApproval(
  currentCase: Case,
  draft: CaseDraft
): { nextCase: Case; event: CaseEvent } {
  assertTransition(currentCase.status, 'WAITING_APPROVAL');

  const nextDraftVersion = (currentCase.draftVersion || 0) + 1;
  const hadPendingApproval = Boolean(currentCase.pendingApproval);

  const event = createCaseEvent(
    currentCase.id,
    'DRAFT_GENERATED',
    `Supplier inquiry draft prepared for ${draft.recipient}`,
    { recipient: draft.recipient, subject: draft.subject, draftVersion: nextDraftVersion },
    currentCase.isReal
  );

  const events: CaseEvent[] = [event];
  if (hadPendingApproval) {
    events.unshift(
      createCaseEvent(
        currentCase.id,
        'APPROVAL_INVALIDATED',
        'Prior send approval invalidated because the draft changed.',
        { previousDraftVersion: currentCase.draftVersion },
        currentCase.isReal
      )
    );
  }

  return {
    nextCase: {
      ...currentCase,
      draft,
      draftVersion: nextDraftVersion,
      pendingApproval: undefined,
      status: 'WAITING_APPROVAL',
      contact: {
        ...currentCase.contact,
        email: draft.recipient,
      },
      events: [...events, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event,
  };
}

/**
 * Pure transition: records a human approval bound to the exact draft
 * content (recipient/subject/body) and the current draftVersion. This is
 * the ONLY way a Case can acquire a pendingApproval; transitionToSent
 * refuses to run without one that still matches.
 */
export function recordDraftApproval(
  currentCase: Case,
  params: { approvedBy: string; recipient: string; subject: string; body: string }
): { success: boolean; nextCase: Case; event?: CaseEvent; reason?: string } {
  if (currentCase.status !== 'WAITING_APPROVAL') {
    return {
      success: false,
      nextCase: currentCase,
      reason: `CASE_NOT_AWAITING_APPROVAL: status is ${currentCase.status}`,
    };
  }
  if (!params.recipient || !params.subject || !params.body) {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'INCOMPLETE_DRAFT: recipient, subject, and body are all required for approval.',
    };
  }

  const approval: CaseApproval = {
    id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'SEND_EMAIL',
    approvedBy: params.approvedBy,
    approvedAt: new Date().toISOString(),
  };

  const event = createCaseEvent(
    currentCase.id,
    'SEND_APPROVED',
    `Outbound supplier email approved by ${params.approvedBy}, bound to draft v${currentCase.draftVersion}`,
    { recipient: params.recipient, draftVersion: currentCase.draftVersion },
    currentCase.isReal
  );

  return {
    success: true,
    nextCase: {
      ...currentCase,
      approvals: [approval, ...currentCase.approvals],
      pendingApproval: {
        id: approval.id,
        approvedBy: params.approvedBy,
        approvedAt: approval.approvedAt,
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        draftVersion: currentCase.draftVersion,
      },
      events: [event, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event,
  };
}

/**
 * Pure transition: mark sent. Requires a pendingApproval that exactly
 * matches the outbound content and the Case's current draftVersion — this
 * is the real enforcement of "no send without recorded, unstale approval",
 * replacing a hardcoded boolean policy check. Also guards idempotency:
 * a Case that is already SENT/WAITING_REPLY cannot be sent again.
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

  const approval = currentCase.pendingApproval;
  if (!approval) {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'NO_VALID_APPROVAL: this Case has no recorded human approval to send.',
    };
  }
  if (approval.draftVersion !== currentCase.draftVersion) {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'APPROVAL_STALE: the draft changed after approval was recorded.',
    };
  }
  if (
    approval.recipient !== outbound.recipient ||
    approval.subject !== outbound.subject ||
    approval.body !== outbound.body
  ) {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'APPROVAL_CONTENT_MISMATCH: outbound content differs from the approved draft.',
    };
  }

  assertTransition(currentCase.status, 'WAITING_REPLY');

  const sentMessage: CaseMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'AGENT',
    authorName: 'Maya (AI Procurement Lead)',
    email: outbound.approvedBy,
    subject: outbound.subject,
    body: outbound.body,
    timestamp: new Date().toISOString(),
    externalMessageId: outbound.messageId,
    senderVerified: true,
  };

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
      pendingApproval: undefined, // approval consumed
      messages: [sentMessage, ...currentCase.messages],
      events: [sentEvent, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event: sentEvent,
  };
}

/**
 * Pure transition: record reply and extracted state (idempotent by externalMessageId).
 * Only ever called for messages whose sender has been verified against the
 * Case's known counterparty — see transitionToUnverifiedSender for the
 * alternative path taken when the sender cannot be trusted.
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

  const hasSecurityFlags = Boolean(
    inbound.extracted.securityFlags && inbound.extracted.securityFlags.length > 0
  );
  const nextStatus: CaseStatus = hasSecurityFlags ? 'SECURITY_REVIEW' : 'NEEDS_DECISION';
  assertTransition(currentCase.status, nextStatus);

  const replyMessage: CaseMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'COUNTERPARTY',
    authorName: inbound.fromName || inbound.fromEmail,
    email: inbound.fromEmail,
    subject: inbound.subject,
    body: inbound.body,
    timestamp: new Date().toISOString(),
    externalMessageId: inbound.messageId,
    senderVerified: true,
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
    `Parsed structured facts: ETA ${inbound.extracted.confirmedEta || 'Unknown'}, Reason: ${inbound.extracted.delayReason || 'Unknown'}`,
    { extracted: inbound.extracted },
    currentCase.isReal
  );

  const generatedEvents: CaseEvent[] = [parsedEvent, replyEvent];

  if (hasSecurityFlags) {
    const flagEvent = createCaseEvent(
      currentCase.id,
      'SECURITY_FLAG_RAISED',
      `Security flag: ${inbound.extracted.securityFlags![0]}`,
      { flags: inbound.extracted.securityFlags },
      currentCase.isReal
    );
    generatedEvents.unshift(flagEvent);
  } else {
    const decisionEvent = createCaseEvent(
      currentCase.id,
      'DECISION_REQUIRED',
      `Human decision required on supplier terms`,
      undefined,
      currentCase.isReal
    );
    generatedEvents.unshift(decisionEvent);
  }

  return {
    success: true,
    nextCase: {
      ...currentCase,
      status: nextStatus,
      messages: [replyMessage, ...currentCase.messages],
      events: [...generatedEvents, ...currentCase.events],
      extractedState: inbound.extracted,
      updatedAt: new Date().toISOString(),
    },
    events: generatedEvents,
  };
}

/**
 * Pure transition: a reply arrived on the thread from an address that does
 * not match the Case's trusted counterparty. The message is recorded for
 * human review, but extractedState/trusted facts are NEVER updated from it.
 */
export function transitionToUnverifiedSender(
  currentCase: Case,
  inbound: {
    messageId: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    body: string;
  }
): { success: boolean; nextCase: Case; event?: CaseEvent; reason?: string } {
  const alreadyProcessed = currentCase.messages.some(
    (m) => m.externalMessageId === inbound.messageId
  );
  if (alreadyProcessed) {
    return { success: false, nextCase: currentCase, reason: 'MESSAGE_ALREADY_PROCESSED' };
  }

  const message: CaseMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'COUNTERPARTY',
    authorName: inbound.fromName || inbound.fromEmail,
    email: inbound.fromEmail,
    subject: inbound.subject,
    body: inbound.body,
    timestamp: new Date().toISOString(),
    externalMessageId: inbound.messageId,
    senderVerified: false,
  };

  const event = createCaseEvent(
    currentCase.id,
    'UNVERIFIED_SENDER_DETECTED',
    `Reply received from unverified sender ${inbound.fromEmail}. Trusted facts were NOT updated.`,
    { fromEmail: inbound.fromEmail },
    currentCase.isReal
  );

  return {
    success: true,
    nextCase: {
      ...currentCase,
      needsSenderReview: true,
      messages: [message, ...currentCase.messages],
      events: [event, ...currentCase.events],
      updatedAt: new Date().toISOString(),
    },
    event,
  };
}

/**
 * Pure transition: resolve case (e.g. credit accepted). A Case parked in
 * SECURITY_REVIEW cannot resolve without an explicit human acknowledgement
 * of the flagged risk — this is the blocking condition required for
 * bank-detail-change / wire-instruction messages.
 */
export function transitionToResolved(
  currentCase: Case,
  resolution: {
    approvedBy: string;
    acceptedCredit?: number;
    notes?: string;
    securityReviewAcknowledged?: boolean;
  }
): { success: boolean; nextCase: Case; event?: CaseEvent; reason?: string } {
  if (currentCase.status === 'RESOLVED') {
    return {
      success: false,
      nextCase: currentCase,
      reason: 'ALREADY_RESOLVED',
    };
  }

  if (currentCase.status === 'SECURITY_REVIEW' && !resolution.securityReviewAcknowledged) {
    return {
      success: false,
      nextCase: currentCase,
      reason:
        'SECURITY_REVIEW_REQUIRED: this Case has a flagged financial instruction and requires explicit human acknowledgement before it can resolve.',
    };
  }

  assertTransition(currentCase.status, 'RESOLVED');

  const approval: CaseApproval = {
    id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
