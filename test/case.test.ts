/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSupplierCase,
  transitionToWaitingApproval,
  transitionToSent,
  transitionToReplyReceived,
  transitionToResolved,
  canTransitionCase,
} from '../src/domain/case/stateTransitions.ts';
import { ActionPolicy } from '../server/policy/actionPolicy.ts';
import { parseSupplierReply } from '../server/ai/supplierReplyParser.ts';

describe('Case Domain Model & Lifecycle Transitions', () => {
  it('1. Initializes default case in DRAFT_READY state with objective and contact', () => {
    const c = createInitialSupplierCase({
      poNumber: '511',
      contactName: 'Kurt Vance',
      contactEmail: 'kurt@example.com',
    });

    assert.equal(c.type, 'SUPPLIER_EXCEPTION');
    assert.equal(c.status, 'DRAFT_READY');
    assert.equal(c.poNumber, '511');
    assert.equal(c.contact.email, 'kurt@example.com');
    assert.ok(c.draft, 'Draft must be initialized');
    assert.equal(c.events.length, 1, 'Initial CASE_CREATED event must exist');
    assert.equal(c.events[0].type, 'CASE_CREATED');
  });

  it('2. Transition DRAFT_READY -> WAITING_APPROVAL records draft and event', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase, event } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
      generatedByAi: true,
    });

    assert.equal(nextCase.status, 'WAITING_APPROVAL');
    assert.equal(nextCase.draft?.recipient, 'supplier@acme.com');
    assert.equal(event.type, 'DRAFT_GENERATED');
    assert.equal(nextCase.events.length, 2);
  });

  it('3. Transition WAITING_APPROVAL -> SENT -> WAITING_REPLY records sent message and approval', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase: draftReady } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
    });

    const res = transitionToSent(draftReady, {
      messageId: 'gmail-msg-101',
      threadId: 'gmail-th-202',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
    });

    assert.equal(res.success, true);
    assert.equal(res.nextCase.status, 'WAITING_REPLY');
    assert.equal(res.nextCase.externalMessageId, 'gmail-msg-101');
    assert.equal(res.nextCase.externalThreadId, 'gmail-th-202');
    assert.equal(res.nextCase.approvals.length, 1);
    assert.equal(res.nextCase.approvals[0].type, 'SEND_EMAIL');
    assert.equal(res.nextCase.messages.length, 1);
    assert.equal(res.nextCase.messages[0].role, 'AGENT');
  });

  it('4. Idempotency: duplicate approve-send action cannot send twice or duplicate events', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase: draftReady } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
    });

    // First send
    const firstSend = transitionToSent(draftReady, {
      messageId: 'gmail-msg-101',
      threadId: 'gmail-th-202',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
    });
    assert.equal(firstSend.success, true);

    const initialEventsCount = firstSend.nextCase.events.length;
    const initialApprovalsCount = firstSend.nextCase.approvals.length;
    const initialMessagesCount = firstSend.nextCase.messages.length;

    // Second send attempt (same tick / duplicate click)
    const secondSend = transitionToSent(firstSend.nextCase, {
      messageId: 'gmail-msg-102',
      threadId: 'gmail-th-202',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511 Customs Hold Inquiry',
      body: 'Please provide confirmed ETA.',
    });

    assert.equal(secondSend.success, false, 'Second send must be rejected');
    assert.equal(secondSend.reason, 'EMAIL_ALREADY_SENT');
    assert.equal(secondSend.nextCase.events.length, initialEventsCount, 'No duplicate events');
    assert.equal(secondSend.nextCase.approvals.length, initialApprovalsCount, 'No duplicate approvals');
    assert.equal(secondSend.nextCase.messages.length, initialMessagesCount, 'No duplicate messages');
  });

  it('5. Transition WAITING_REPLY -> REPLY_RECEIVED -> NEEDS_DECISION records reply and parsed facts', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase: draftReady } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const { nextCase: sentCase } = transitionToSent(draftReady, {
      messageId: 'msg-1',
      threadId: 'th-1',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });

    const replyRes = transitionToReplyReceived(sentCase, {
      messageId: 'supplier-reply-999',
      fromEmail: 'kurt@acme.com',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'Container cleared customs. New ETA is Friday. We offer $400 courtesy credit.',
      extracted: {
        delayReason: 'Customs clearance hold',
        confirmedEta: 'Friday',
        creditOffer: { amount: 400, currency: 'USD' },
        requiresHumanDecision: true,
        confidence: 0.95,
      },
    });

    assert.equal(replyRes.success, true);
    assert.equal(replyRes.nextCase.status, 'NEEDS_DECISION');
    assert.equal(replyRes.nextCase.messages.length, 2, 'Outbound and inbound messages recorded');
    assert.equal(replyRes.nextCase.messages[0].role, 'COUNTERPARTY');
    assert.equal(replyRes.nextCase.extractedState?.confirmedEta, 'Friday');
    assert.equal(replyRes.nextCase.extractedState?.creditOffer?.amount, 400);
  });

  it('6. Idempotency: duplicate Gmail message ingestion ignores duplicate message and creates no duplicate events', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase: draftReady } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const { nextCase: sentCase } = transitionToSent(draftReady, {
      messageId: 'msg-1',
      threadId: 'th-1',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });

    // Ingest reply first time
    const res1 = transitionToReplyReceived(sentCase, {
      messageId: 'supplier-reply-999',
      fromEmail: 'kurt@acme.com',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'New ETA is Friday.',
      extracted: {
        confirmedEta: 'Friday',
        requiresHumanDecision: true,
      },
    });
    assert.equal(res1.success, true);

    const eventsCountAfterReply = res1.nextCase.events.length;
    const messagesCountAfterReply = res1.nextCase.messages.length;

    // Ingest identical message again (e.g. sync thread run a second time)
    const res2 = transitionToReplyReceived(res1.nextCase, {
      messageId: 'supplier-reply-999', // same messageId
      fromEmail: 'kurt@acme.com',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'New ETA is Friday.',
      extracted: {
        confirmedEta: 'Friday',
        requiresHumanDecision: true,
      },
    });

    assert.equal(res2.success, false, 'Duplicate messageId must be rejected');
    assert.equal(res2.reason, 'MESSAGE_ALREADY_PROCESSED');
    assert.equal(res2.nextCase.events.length, eventsCountAfterReply, 'No duplicate events created');
    assert.equal(res2.nextCase.messages.length, messagesCountAfterReply, 'No duplicate messages created');
  });

  it('7. Transition NEEDS_DECISION -> RESOLVED accepts credit and seals case', () => {
    const initial = createInitialSupplierCase({ poNumber: '511' });
    const { nextCase: draftReady } = transitionToWaitingApproval(initial, {
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const { nextCase: sentCase } = transitionToSent(draftReady, {
      messageId: 'msg-1',
      threadId: 'th-1',
      approvedBy: 'Alex Founder',
      recipient: 'supplier@acme.com',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const { nextCase: decisionCase } = transitionToReplyReceived(sentCase, {
      messageId: 'msg-reply',
      fromEmail: 'kurt@acme.com',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: '$400 credit',
      extracted: {
        creditOffer: { amount: 400, currency: 'USD' },
        requiresHumanDecision: true,
      },
    });

    const resolveRes = transitionToResolved(decisionCase, {
      approvedBy: 'Alex Founder',
      acceptedCredit: 400,
    });

    assert.equal(resolveRes.success, true);
    assert.equal(resolveRes.nextCase.status, 'RESOLVED');
    assert.equal(resolveRes.nextCase.approvals.some((a) => a.type === 'ACCEPT_CREDIT'), true);

    // Cannot resolve twice
    const secondResolve = transitionToResolved(resolveRes.nextCase, {
      approvedBy: 'Alex Founder',
      acceptedCredit: 400,
    });
    assert.equal(secondResolve.success, false);
    assert.equal(secondResolve.reason, 'ALREADY_RESOLVED');
  });
});

describe('Action Policy & Bank Fraud Security Hard Boundary', () => {
  it('8. Policy blocks automated email send without human approval', () => {
    const check1 = ActionPolicy.canSendEmail(false);
    assert.equal(check1.allowed, false);
    assert.ok(check1.reason?.includes('Human approval is strictly required'));

    const check2 = ActionPolicy.canSendEmail(true);
    assert.equal(check2.allowed, true);
  });

  it('9. Policy blocks prohibited business actions in Real Supplier Mode v0', () => {
    const actions = [
      'CHANGE_PO_QUANTITY',
      'CHANGE_PRICE',
      'ACCEPT_CONTRACTUAL_TERMS',
      'PAY_MONEY',
      'CHANGE_BANK_DETAILS',
    ];

    for (const act of actions) {
      const res = ActionPolicy.checkProhibitedAction(act);
      assert.equal(res.allowed, false, `Action ${act} must be prohibited`);
      assert.ok(res.reason.includes('strictly prohibited'));
    }
  });

  it('10. Bank Fraud Detection: message with wire instructions or changed bank accounts raises SECURITY FLAG', async () => {
    const maliciousReply = `
      Hi Alex,
      Our container was delayed. Also note our accounting department updated our bank account.
      Please wire the invoice balance immediately via wire instructions:
      IBAN: US98BANK00012345678901
      Routing number: 021000021
      Do not pay to our old account.
    `;

    const extracted = await parseSupplierReply(maliciousReply);

    assert.equal(extracted.requiresHumanDecision, true, 'Must force human decision');
    assert.ok(extracted.securityFlags && extracted.securityFlags.length > 0, 'Security flags must be raised');
    assert.ok(
      extracted.securityFlags?.some((f) => f.includes('Financial instruction requires independent human verification')),
      'Must contain primary security warning'
    );
  });

  it('11. Benign delay message does not raise bank security flags', async () => {
    const normalReply = `
      Hi Maya,
      Container held at customs inspection. Release expected Thursday evening. Pickup Friday.
      We offer a $400 credit on invoice 511.
    `;

    const extracted = await parseSupplierReply(normalReply);

    assert.equal(extracted.securityFlags?.length || 0, 0, 'Must have zero security flags');
    assert.equal(extracted.creditOffer?.amount, 400);
    assert.ok(extracted.confirmedEta?.toLowerCase().includes('friday'));
  });

  it('12. State transitions validation function checks valid vs invalid transitions', () => {
    assert.equal(canTransitionCase('DETECTED', 'DRAFT_READY'), true);
    assert.equal(canTransitionCase('DRAFT_READY', 'WAITING_APPROVAL'), true);
    assert.equal(canTransitionCase('WAITING_APPROVAL', 'SENT'), true);
    assert.equal(canTransitionCase('SENT', 'WAITING_REPLY'), true);
    assert.equal(canTransitionCase('WAITING_REPLY', 'REPLY_RECEIVED'), true);
    assert.equal(canTransitionCase('REPLY_RECEIVED', 'NEEDS_DECISION'), true);
    assert.equal(canTransitionCase('NEEDS_DECISION', 'RESOLVED'), true);

    // Invalid jumps
    assert.equal(canTransitionCase('DETECTED', 'RESOLVED'), false);
    assert.equal(canTransitionCase('WAITING_REPLY', 'RESOLVED'), false);
  });
});

describe('Case Persistence & Repository', () => {
  it('13. CaseRepository loads initial case, persists state modifications and loads accurately', async () => {
    const { CaseRepository } = await import('../server/cases/caseRepository.ts');
    const repo = new CaseRepository();
    const active = repo.getActiveCase();
    assert.ok(active, 'Active case must exist');
    assert.equal(active.type, 'SUPPLIER_EXCEPTION');

    // Modify active case status
    const updated = {
      ...active,
      status: 'WAITING_APPROVAL' as const,
      poNumber: '511',
    };
    repo.save(updated);

    const reloaded = repo.getById(active.id);
    assert.ok(reloaded);
    assert.equal(reloaded.status, 'WAITING_APPROVAL');

    // Reset repository back to initial state
    const resetCase = repo.reset();
    assert.ok(resetCase);
    assert.equal(resetCase.status, 'DRAFT_READY');
  });
});

