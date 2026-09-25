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
  | 'RESOLVED'
  | 'FAILED';

export type CaseEventType =
  | 'CASE_CREATED'
  | 'DRAFT_GENERATED'
  | 'SEND_APPROVAL_REQUESTED'
  | 'SEND_APPROVED'
  | 'EMAIL_SENT'
  | 'SUPPLIER_REPLY_RECEIVED'
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
  communicationRail: 'GMAIL';
  externalThreadId?: string;
  externalMessageId?: string;
  draft?: CaseDraft;
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
