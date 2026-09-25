/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CaseStatus =
  | 'DETECTED'
  | 'DRAFT_READY'
  | 'WAITING_APPROVAL'
  | 'SENT'
  | 'WAITING_REPLY'
  | 'REPLY_RECEIVED'
  | 'NEEDS_DECISION'
  | 'SECURITY_REVIEW'
  | 'RESOLVED'
  | 'FAILED';

export type CaseEventType =
  | 'CASE_CREATED'
  | 'DRAFT_GENERATED'
  | 'SEND_APPROVAL_REQUESTED'
  | 'SEND_APPROVED'
  | 'APPROVAL_INVALIDATED'
  | 'EMAIL_SENT'
  | 'SUPPLIER_REPLY_RECEIVED'
  | 'UNVERIFIED_SENDER_DETECTED'
  | 'REPLY_PARSED'
  | 'DECISION_REQUIRED'
  | 'CREDIT_ACCEPTED'
  | 'SECURITY_FLAG_RAISED'
  | 'CASE_RESOLVED'
  | 'CASE_FAILED';

export interface CounterpartyContact {
  name?: string;
  email: string;
  organizationName?: string;
  organizationId?: string;
}

export interface CaseMessage {
  id: string;
  role: 'USER' | 'AGENT' | 'COUNTERPARTY';
  authorName: string;
  email: string;
  subject: string;
  body: string;
  timestamp: string;
  externalMessageId?: string;
  /**
   * false when the message's From address did not match the Case's known
   * counterparty contact/allowlist. Unverified messages must never update
   * trusted extracted facts — see stateTransitions.transitionToUnverifiedSender.
   */
  senderVerified?: boolean;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  type: CaseEventType;
  timestamp: string;
  summary: string;
  payload?: Record<string, any>;
  isReal?: boolean;
}

export interface CaseApproval {
  id: string;
  type: 'SEND_EMAIL' | 'ACCEPT_CREDIT';
  approvedBy: string;
  approvedAt: string;
  comments?: string;
}

/**
 * A human approval bound to the exact draft content it was granted for.
 * Consumed (cleared) by transitionToSent. Invalidated (cleared) whenever
 * the draft changes after approval was recorded — see transitionToWaitingApproval.
 */
export interface PendingSendApproval {
  id: string;
  approvedBy: string;
  approvedAt: string;
  recipient: string;
  subject: string;
  body: string;
  draftVersion: number;
}

export interface CaseExtractedState {
  confirmedEta?: string;
  delayReason?: string;
  creditOffer?: {
    amount: number;
    currency: string;
  };
  missingDocuments?: string[];
  commitments?: string[];
  requiresHumanDecision?: boolean;
  securityFlags?: string[];
  confidence?: number;
  rawSummary?: string;
}

export interface CaseDraft {
  recipient: string;
  subject: string;
  body: string;
  generatedByAi?: boolean;
}

export interface Case {
  id: string;
  type: 'SUPPLIER_EXCEPTION';
  organizationId: string;
  counterpartyId: string;
  status: CaseStatus;
  poNumber?: string;
  objective: string;
  contact: CounterpartyContact;
  /** Email addresses trusted as the real counterparty. Defaults to [contact.email]. */
  allowedCounterpartyEmails?: string[];
  communicationRail: 'GMAIL';
  externalThreadId?: string;
  externalMessageId?: string;
  draft?: CaseDraft;
  /** Incremented every time the draft's recipient/subject/body changes. */
  draftVersion: number;
  /** Set when a human approves the current draft; cleared on edit or on send. */
  pendingApproval?: PendingSendApproval;
  /** True once a supplier reply arrives from an address we could not verify. */
  needsSenderReview?: boolean;
  messages: CaseMessage[];
  events: CaseEvent[];
  approvals: CaseApproval[];
  extractedState?: CaseExtractedState;
  isReal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresHumanApproval?: boolean;
  securityFlags?: string[];
}
