/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hardened Case domain + service test suite.
 *
 * Design constraints (see README.md "Testing"):
 *  - No live Gemini calls: NODE_ENV=test forces serverConfig.geminiApiKey to
 *    '' (server/config.ts), so parseSupplierReply/generateSupplierDraft
 *    always take their deterministic offline fallback path here.
 *  - No live Gmail calls: GmailClient's static methods are monkey-patched
 *    per-test and restored in afterEach.
 *  - No shared/production state: every test constructs its own
 *    `new CaseRepository({ filePath: null, autoSeed: false })`, which never
 *    touches disk and never touches another test's cases.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createInitialSupplierCase,
  transitionToWaitingApproval,
  recordDraftApproval,
  transitionToSent,
  transitionToReplyReceived,
  transitionToUnverifiedSender,
  transitionToResolved,
  canTransitionCase,
} from '../src/domain/case/stateTransitions.ts';
import { Case } from '../src/domain/case/types.ts';
import { ActionPolicy } from '../server/policy/actionPolicy.ts';
import { parseSupplierReply, validateExtractedState } from '../server/ai/supplierReplyParser.ts';
import { generateSupplierDraft } from '../server/ai/supplierEmailDraft.ts';
import { CaseRepository } from '../server/cases/caseRepository.ts';
import { CaseService } from '../server/cases/caseService.ts';
import { GmailClient } from '../server/gmail/gmailClient.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function freshCase(overrides: Partial<Case> = {}): Case {
  const base = createInitialSupplierCase({
    poNumber: '511',
    contactName: 'Kurt Vance',
    contactEmail: 'kurt@acme.example',
  });
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Domain: draft lifecycle, approval binding, invalidation, idempotent send
// ---------------------------------------------------------------------------

describe('Case domain: draft, approval binding, and send idempotency', () => {
  it('initializes a new case in DRAFT_READY with draftVersion 1', () => {
    const c = createInitialSupplierCase({ poNumber: '511', contactEmail: 'kurt@acme.example' });
    assert.equal(c.status, 'DRAFT_READY');
    assert.equal(c.draftVersion, 1);
    assert.equal(c.events[0].type, 'CASE_CREATED');
  });

  it('transitionToWaitingApproval bumps draftVersion and clears any pending approval', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    assert.equal(waiting.status, 'WAITING_APPROVAL');
    assert.equal(waiting.draftVersion, initial.draftVersion + 1);
    assert.equal(waiting.pendingApproval, undefined);
  });

  it('B. a Case without a recorded approval cannot send', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });

    const send = transitionToSent(waiting, {
      messageId: 'gmail-1',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });

    assert.equal(send.success, false);
    assert.match(send.reason || '', /NO_VALID_APPROVAL/);
  });

  it('recordDraftApproval binds an approval to the exact recipient/subject/body/draftVersion', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });

    const approved = recordDraftApproval(waiting, {
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });

    assert.equal(approved.success, true);
    assert.ok(approved.nextCase.pendingApproval);
    assert.equal(approved.nextCase.pendingApproval?.draftVersion, waiting.draftVersion);

    const send = transitionToSent(approved.nextCase, {
      messageId: 'gmail-1',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    assert.equal(send.success, true);
    assert.equal(send.nextCase.status, 'WAITING_REPLY');
    assert.equal(send.nextCase.pendingApproval, undefined, 'approval must be consumed');
  });

  it('C. editing the draft after approval invalidates that approval', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    const approved = recordDraftApproval(waiting, {
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    assert.equal(approved.success, true);

    // Edit the draft after approval was granted.
    const { nextCase: editedCase } = transitionToWaitingApproval(approved.nextCase, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511 (revised)',
      body: 'Please confirm ETA and reason for delay.',
    });
    assert.equal(editedCase.pendingApproval, undefined);
    assert.ok(
      editedCase.events.some((e) => e.type === 'APPROVAL_INVALIDATED'),
      'must record an APPROVAL_INVALIDATED event'
    );

    // Attempting to send with the OLD approved content must fail: there is
    // no pendingApproval at all anymore.
    const send = transitionToSent(editedCase, {
      messageId: 'gmail-1',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    assert.equal(send.success, false);
    assert.match(send.reason || '', /NO_VALID_APPROVAL/);
  });

  it('D. repeated send after SENT (WAITING_REPLY) is rejected with no duplicate events/messages', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    const approved = recordDraftApproval(waiting, {
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    const firstSend = transitionToSent(approved.nextCase, {
      messageId: 'gmail-1',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    assert.equal(firstSend.success, true);

    const eventsCount = firstSend.nextCase.events.length;
    const messagesCount = firstSend.nextCase.messages.length;

    const secondSend = transitionToSent(firstSend.nextCase, {
      messageId: 'gmail-2',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });

    assert.equal(secondSend.success, false);
    assert.equal(secondSend.reason, 'EMAIL_ALREADY_SENT');
    assert.equal(secondSend.nextCase.events.length, eventsCount);
    assert.equal(secondSend.nextCase.messages.length, messagesCount);
  });

  it('L. duplicate Gmail message ingestion is processed once (no duplicate events/messages)', () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const approved = recordDraftApproval(waiting, {
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'ETA?',
    });
    const sent = transitionToSent(approved.nextCase, {
      messageId: 'gmail-1',
      threadId: 'thread-1',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'ETA?',
    });

    const firstReply = transitionToReplyReceived(sent.nextCase, {
      messageId: 'supplier-reply-1',
      fromEmail: 'kurt@acme.example',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'New ETA is Friday.',
      extracted: { confirmedEta: 'Friday', requiresHumanDecision: true, confidence: 0.8 },
    });
    assert.equal(firstReply.success, true);

    const eventsAfter = firstReply.nextCase.events.length;
    const messagesAfter = firstReply.nextCase.messages.length;

    const secondReply = transitionToReplyReceived(firstReply.nextCase, {
      messageId: 'supplier-reply-1', // same id
      fromEmail: 'kurt@acme.example',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'New ETA is Friday.',
      extracted: { confirmedEta: 'Friday', requiresHumanDecision: true, confidence: 0.8 },
    });

    assert.equal(secondReply.success, false);
    assert.equal(secondReply.reason, 'MESSAGE_ALREADY_PROCESSED');
    assert.equal(secondReply.nextCase.events.length, eventsAfter);
    assert.equal(secondReply.nextCase.messages.length, messagesAfter);
  });
});

// ---------------------------------------------------------------------------
// Domain: security review gating and unverified-sender isolation
// ---------------------------------------------------------------------------

describe('Case domain: security review and sender trust boundaries', () => {
  it('I. a reply with a flagged financial instruction routes to SECURITY_REVIEW, not NEEDS_DECISION', () => {
    const c = { ...freshCase(), status: 'WAITING_REPLY' as const };
    const res = transitionToReplyReceived(c, {
      messageId: 'm1',
      fromEmail: 'kurt@acme.example',
      fromName: 'Kurt Vance',
      subject: 'Re: PO #511',
      body: 'Our bank account has changed, please wire to the new IBAN.',
      extracted: {
        securityFlags: ['Financial instruction requires independent human verification.'],
        requiresHumanDecision: true,
        confidence: 0.9,
      },
    });
    assert.equal(res.success, true);
    assert.equal(res.nextCase.status, 'SECURITY_REVIEW');
  });

  it('SECURITY_REVIEW cannot resolve without explicit acknowledgement; blocks by default', () => {
    const c = { ...freshCase(), status: 'SECURITY_REVIEW' as const };
    const blocked = transitionToResolved(c, { approvedBy: 'alex@mycompany.example' });
    assert.equal(blocked.success, false);
    assert.match(blocked.reason || '', /SECURITY_REVIEW_REQUIRED/);

    const acknowledged = transitionToResolved(c, {
      approvedBy: 'alex@mycompany.example',
      securityReviewAcknowledged: true,
    });
    assert.equal(acknowledged.success, true);
    assert.equal(acknowledged.nextCase.status, 'RESOLVED');
  });

  it('J. a RESOLVED case cannot be resolved again', () => {
    const c = { ...freshCase(), status: 'REPLY_RECEIVED' as const };
    const resolved = transitionToResolved(c, { approvedBy: 'alex@mycompany.example', acceptedCredit: 400 });
    assert.equal(resolved.success, true);

    const secondResolve = transitionToResolved(resolved.nextCase, { approvedBy: 'alex@mycompany.example' });
    assert.equal(secondResolve.success, false);
    assert.equal(secondResolve.reason, 'ALREADY_RESOLVED');
  });

  it('G. an unverified sender never updates trusted extractedState', () => {
    const c = { ...freshCase(), status: 'WAITING_REPLY' as const };
    assert.equal(c.extractedState, undefined);

    const res = transitionToUnverifiedSender(c, {
      messageId: 'spoofed-1',
      fromEmail: 'attacker@not-acme.example',
      fromName: 'Fake Kurt',
      subject: 'Re: PO #511',
      body: 'New bank account: pay here instead.',
    });

    assert.equal(res.success, true);
    assert.equal(res.nextCase.extractedState, undefined, 'extractedState must remain untouched');
    assert.equal(res.nextCase.needsSenderReview, true);
    assert.equal(res.nextCase.status, 'WAITING_REPLY', 'status must not advance from an unverified message');
    assert.equal(res.nextCase.messages[0].senderVerified, false);
    assert.ok(res.nextCase.events.some((e) => e.type === 'UNVERIFIED_SENDER_DETECTED'));
  });
});

describe('Case domain: transition table enforcement', () => {
  it('12. valid vs invalid status transitions', () => {
    assert.equal(canTransitionCase('DETECTED', 'DRAFT_READY'), true);
    assert.equal(canTransitionCase('DRAFT_READY', 'WAITING_APPROVAL'), true);
    assert.equal(canTransitionCase('WAITING_APPROVAL', 'SENT'), true);
    assert.equal(canTransitionCase('WAITING_REPLY', 'NEEDS_DECISION'), true);
    assert.equal(canTransitionCase('WAITING_REPLY', 'SECURITY_REVIEW'), true);
    assert.equal(canTransitionCase('NEEDS_DECISION', 'RESOLVED'), true);
    assert.equal(canTransitionCase('SECURITY_REVIEW', 'RESOLVED'), true);

    assert.equal(canTransitionCase('DETECTED', 'RESOLVED'), false);
    assert.equal(canTransitionCase('WAITING_REPLY', 'RESOLVED'), false);
    assert.equal(canTransitionCase('RESOLVED', 'SENT'), false);
    assert.equal(canTransitionCase('RESOLVED', 'WAITING_APPROVAL'), false);
  });
});

// ---------------------------------------------------------------------------
// ActionPolicy: deterministic, non-LLM security boundary
// ---------------------------------------------------------------------------

describe('ActionPolicy: deterministic security boundary', () => {
  it('blocks send/credit-accept without an approval boolean, allows with one', () => {
    assert.equal(ActionPolicy.canSendEmail(false).allowed, false);
    assert.equal(ActionPolicy.canSendEmail(true).allowed, true);
    assert.equal(ActionPolicy.canAcceptCredit(false).allowed, false);
    assert.equal(ActionPolicy.canAcceptCredit(true).allowed, true);
  });

  it('prohibits hard-coded dangerous actions regardless of approval', () => {
    for (const action of ['CHANGE_PO_QUANTITY', 'CHANGE_PRICE', 'PAY_MONEY', 'CHANGE_BANK_DETAILS']) {
      const res = ActionPolicy.checkProhibitedAction(action);
      assert.equal(res.allowed, false);
    }
  });

  it('flags wire/bank/crypto instructions and does not flag benign delay messages', () => {
    const malicious = ActionPolicy.scanForFinancialFraud(
      'Our bank account has changed. Please wire the balance to our new IBAN US98BANK00012345678901.'
    );
    assert.equal(malicious.hasSecurityRisk, true);
    assert.ok(malicious.flags.length > 0);

    const benign = ActionPolicy.scanForFinancialFraud('Container held at customs. Release expected Thursday.');
    assert.equal(benign.hasSecurityRisk, false);
  });
});

// ---------------------------------------------------------------------------
// AI boundary: no invented facts, Gemini output validated not trusted
// ---------------------------------------------------------------------------

describe('AI boundary: no invented facts (offline fallback, no live Gemini calls)', () => {
  it('E/F. fallback parser never invents a cause or a time beyond what is literally stated', async () => {
    const extracted = await parseSupplierReply(
      'Hi Alex, the shipment is delayed due to customs. We will follow up soon.'
    );
    // "customs" is present -> delayReason may be set, but must be the
    // verbatim sentence, never the old hardcoded fabrication.
    assert.notEqual(extracted.delayReason, 'Customs tariff re-classification hold');
    if (extracted.delayReason) {
      assert.ok(extracted.delayReason.toLowerCase().includes('customs'));
    }
    // No day-of-week mentioned anywhere -> confirmedEta must remain unknown,
    // never a fabricated specific time.
    assert.equal(extracted.confirmedEta, undefined);
  });

  it('unknown facts remain unknown when nothing is stated', async () => {
    const extracted = await parseSupplierReply('Thanks for reaching out, we will look into it.');
    assert.equal(extracted.delayReason, undefined);
    assert.equal(extracted.confirmedEta, undefined);
    assert.equal(extracted.creditOffer, undefined);
  });

  it('extracts a literal day and credit amount without inventing extra specificity', async () => {
    const extracted = await parseSupplierReply(
      'Container held at customs inspection. Release expected Thursday evening. We offer a $400 credit.'
    );
    assert.ok(extracted.confirmedEta, 'must find the stated day');
    assert.doesNotMatch(extracted.confirmedEta || '', /\d{1,2}:\d{2}\s?(AM|PM|am|pm)/, 'must not invent a specific time');
    assert.equal(extracted.creditOffer?.amount, 400);
    assert.equal(extracted.creditOffer?.currency, 'USD');
  });

  it('M. invalid/malformed model output cannot corrupt a Case: validateExtractedState sanitizes it', () => {
    const malformed = {
      confidence: 'not-a-number',
      creditOffer: { amount: -500, currency: 'FAKE' },
      missingDocuments: 'not-an-array',
      commitments: [{ nested: 'object' }, 'valid string'],
      requiresHumanDecision: 'yes', // wrong type
      securityFlags: null,
      delayReason: 12345, // wrong type
      summary: 'x'.repeat(10_000), // oversized
    };

    const result = validateExtractedState(malformed, [], {});

    assert.equal(result.confidence, 0.5, 'invalid confidence falls back to a safe default');
    assert.equal(result.creditOffer, undefined, 'negative amount / unknown currency must be dropped, not coerced');
    assert.deepEqual(result.missingDocuments, [], 'non-array must not be trusted as an array');
    assert.deepEqual(result.commitments, ['valid string'], 'non-string entries must be dropped');
    assert.equal(result.requiresHumanDecision, true, 'wrong-typed boolean must not disable human review');
    assert.equal(result.delayReason, undefined, 'wrong-typed field must not leak through as a fact');
    assert.ok((result.rawSummary || '').length <= 400, 'oversized string must be bounded');
  });

  it('a valid, well-typed model output is preserved as-is', () => {
    const valid = {
      confidence: 0.87,
      creditOffer: { amount: 250, currency: 'usd' },
      missingDocuments: ['packing list'],
      commitments: ['ship by Monday'],
      requiresHumanDecision: true,
      securityFlags: [],
      delayReason: 'port congestion',
      summary: 'Supplier confirmed a $250 credit.',
    };
    const result = validateExtractedState(valid, [], {});
    assert.equal(result.creditOffer?.amount, 250);
    assert.equal(result.creditOffer?.currency, 'USD');
    assert.equal(result.delayReason, 'port congestion');
    assert.equal(result.confidence, 0.87);
  });
});

describe('AI boundary: email drafts never invent logistics context', () => {
  it('default draft (no Gemini key in test mode) contains no invented specifics', async () => {
    const draft = await generateSupplierDraft({
      poNumber: '511',
      contactEmail: 'kurt@acme.example',
    });
    const lower = draft.body.toLowerCase();
    for (const invented of ['freight dispatch tracking', 'customs transit', 'chassis', 'assembly facility']) {
      assert.ok(!lower.includes(invented), `must not invent "${invented}" with no supporting Case facts`);
    }
  });

  it('draft reflects a provided objective instead of inventing one', async () => {
    const draft = await generateSupplierDraft({
      poNumber: '511',
      contactEmail: 'kurt@acme.example',
      objective: 'Confirm whether the packing list has shipped.',
    });
    assert.ok(draft.body.includes('Confirm whether the packing list has shipped.'));
  });
});

// ---------------------------------------------------------------------------
// Repository: deterministic active-case selection, full test isolation
// ---------------------------------------------------------------------------

describe('CaseRepository: deterministic active-case selection (N)', () => {
  it('N. selects the most-recently-updated non-resolved case, never Map insertion order', () => {
    const repo = new CaseRepository({ filePath: null, autoSeed: false });

    const a = { ...freshCase({ id: 'case-test-A' }), updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...freshCase({ id: 'case-test-B' }), updatedAt: '2026-01-03T00:00:00.000Z' };
    const c = { ...freshCase({ id: 'case-test-C' }), updatedAt: '2026-01-02T00:00:00.000Z' };

    // Insert out of chronological order on purpose: A, then C, then B.
    // repo.save() always stamps its own updatedAt=now, so to test recency
    // ordering deterministically we bypass save() and seed the cache
    // directly via the same shape save() would produce.
    (repo as any).cache.set(a.id, a);
    (repo as any).cache.set(c.id, c);
    (repo as any).cache.set(b.id, b);

    assert.equal(repo.getActiveCase().id, 'case-test-B', 'B has the latest updatedAt');

    // Resolve B — the next most recent non-resolved case must win.
    (repo as any).cache.set(b.id, { ...b, status: 'RESOLVED' });
    assert.equal(repo.getActiveCase().id, 'case-test-C');

    // Resolve everything — falls back to the most recently updated overall,
    // which is B (2026-01-03), even though every case is now terminal.
    (repo as any).cache.set(a.id, { ...a, status: 'RESOLVED' });
    (repo as any).cache.set(c.id, { ...c, status: 'RESOLVED' });
    assert.equal(repo.getActiveCase().id, 'case-test-B', 'falls back to the most recently updated case overall');
  });

  it('autoSeed creates a default case only when the repository is truly empty', () => {
    const repo = new CaseRepository({ filePath: null, autoSeed: true });
    const active = repo.getActiveCase();
    assert.ok(active);
    assert.equal(active.status, 'DRAFT_READY');
  });

  it('never touches the real .data/cases.json file used by the production singleton', () => {
    const prodPath = path.resolve(__dirname, '..', '.data', 'cases.json');
    const existedBefore = fs.existsSync(prodPath);
    const statBefore = existedBefore ? fs.statSync(prodPath).mtimeMs : null;

    const repo = new CaseRepository({ filePath: null, autoSeed: true });
    repo.save({ ...repo.getActiveCase(), poNumber: '999' });

    const statAfter = fs.existsSync(prodPath) ? fs.statSync(prodPath).mtimeMs : null;
    assert.equal(statAfter, statBefore, 'the production cases.json file must be untouched by an in-memory repository');
  });
});

// ---------------------------------------------------------------------------
// CaseService: concurrency lock, authenticated identity, sender trust
// ---------------------------------------------------------------------------

// Captured by direct property access (not object-spread): class static
// methods are non-enumerable, so `{...GmailClient}` would silently fail to
// capture them and afterEach would restore `undefined` instead.
const originalGetProfile = GmailClient.getProfile;
const originalSendEmail = GmailClient.sendEmail;
const originalGetThread = GmailClient.getThread;

afterEach(() => {
  // Restore any monkey-patched GmailClient static methods between tests.
  (GmailClient as any).getProfile = originalGetProfile;
  (GmailClient as any).sendEmail = originalSendEmail;
  (GmailClient as any).getThread = originalGetThread;
});

function makeService(seedCase?: Case) {
  const repo = new CaseRepository({ filePath: null, autoSeed: false });
  if (seedCase) repo.save(seedCase);
  const service = new CaseService(repo);
  return { repo, service };
}

describe('CaseService: send concurrency and idempotency', () => {
  it('A. two concurrent approve-and-send calls for the same Case result in exactly one Gmail send', async () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    const { service, repo } = makeService(waiting);

    let sendCallCount = 0;
    (GmailClient as any).sendEmail = async () => {
      sendCallCount++;
      await new Promise((r) => setTimeout(r, 20)); // widen the async race window
      return { messageId: `gmail-${sendCallCount}`, threadId: 'thread-1' };
    };

    const params = {
      caseId: waiting.id,
      accessToken: 'fake-token',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    };

    const [r1, r2] = await Promise.all([service.approveAndSend(params), service.approveAndSend(params)]);

    const successes = [r1, r2].filter((r) => r.success);
    const failures = [r1, r2].filter((r) => !r.success);
    assert.equal(successes.length, 1, 'exactly one of the two concurrent sends must succeed');
    assert.equal(failures.length, 1);
    assert.equal(sendCallCount, 1, 'Gmail sendEmail must be called exactly once');
    assert.equal(repo.getById(waiting.id)?.status, 'WAITING_REPLY');
  });

  it('D. a sequential duplicate send after success is rejected without calling Gmail again', async () => {
    const initial = freshCase();
    const { nextCase: waiting } = transitionToWaitingApproval(initial, {
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    });
    const { service } = makeService(waiting);

    let sendCallCount = 0;
    (GmailClient as any).sendEmail = async () => {
      sendCallCount++;
      return { messageId: `gmail-${sendCallCount}`, threadId: 'thread-1' };
    };

    const params = {
      caseId: waiting.id,
      accessToken: 'fake-token',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'Please confirm ETA.',
    };

    const first = await service.approveAndSend(params);
    assert.equal(first.success, true);

    const second = await service.approveAndSend(params);
    assert.equal(second.success, false);
    assert.equal(second.reason, 'EMAIL_ALREADY_SENT');
    assert.equal(sendCallCount, 1, 'Gmail must not be called again for an already-sent Case');
  });

  it('J. sending on a RESOLVED case is rejected', async () => {
    const resolvedCase = { ...freshCase(), status: 'RESOLVED' as const };
    const { service } = makeService(resolvedCase);

    let sendCallCount = 0;
    (GmailClient as any).sendEmail = async () => {
      sendCallCount++;
      return { messageId: 'gmail-x', threadId: 'thread-x' };
    };

    const result = await service.approveAndSend({
      caseId: resolvedCase.id,
      accessToken: 'fake-token',
      approvedBy: 'alex@mycompany.example',
      recipient: 'kurt@acme.example',
      subject: 'PO #511',
      body: 'ETA?',
    });

    assert.equal(result.success, false);
    assert.equal(sendCallCount, 0);
  });
});

describe('CaseService: authenticated identity and sender verification', () => {
  it('H. the connected mailbox identity is derived from GmailClient.getProfile, never a client-supplied value', async () => {
    const sentCase: Case = {
      ...freshCase(),
      status: 'WAITING_REPLY',
      externalThreadId: 'thread-1',
      allowedCounterpartyEmails: ['kurt@acme.example'],
    };
    const { service, repo } = makeService(sentCase);

    (GmailClient as any).getProfile = async () => ({ emailAddress: 'ALEX@MYCOMPANY.EXAMPLE' });
    (GmailClient as any).getThread = async () => ({
      id: 'thread-1',
      messages: [
        {
          id: 'own-sent-message',
          from: 'Alex Founder <alex@mycompany.example>', // matches the AUTHENTICATED identity
          subject: 'PO #511',
          body: 'Please confirm ETA.',
        },
        {
          id: 'supplier-reply-1',
          from: 'Kurt Vance <kurt@acme.example>',
          subject: 'Re: PO #511',
          body: 'New ETA is Friday.',
        },
      ],
    });

    const result = await service.syncThreadReplies({ caseId: sentCase.id, accessToken: 'fake-token' });
    assert.equal(result.success, true);
    assert.equal(result.newRepliesCount, 1, 'the message matching the AUTHENTICATED mailbox must be excluded as self-sent');
    const saved = repo.getById(sentCase.id)!;
    assert.equal(saved.messages.some((m) => m.externalMessageId === 'supplier-reply-1'), true);
    assert.equal(saved.messages.some((m) => m.externalMessageId === 'own-sent-message'), false);
  });

  it('G. a reply from an unexpected sender does not update trusted extractedState', async () => {
    const sentCase: Case = {
      ...freshCase(),
      status: 'WAITING_REPLY',
      externalThreadId: 'thread-1',
      allowedCounterpartyEmails: ['kurt@acme.example'],
    };
    const { service, repo } = makeService(sentCase);

    (GmailClient as any).getProfile = async () => ({ emailAddress: 'alex@mycompany.example' });
    (GmailClient as any).getThread = async () => ({
      id: 'thread-1',
      messages: [
        {
          id: 'spoofed-1',
          from: 'Not Kurt <attacker@not-acme.example>',
          subject: 'Re: PO #511',
          body: 'Our bank account changed, please pay here instead: $9999',
        },
      ],
    });

    const result = await service.syncThreadReplies({ caseId: sentCase.id, accessToken: 'fake-token' });
    assert.equal(result.success, true);
    const saved = repo.getById(sentCase.id)!;
    assert.equal(saved.extractedState, undefined, 'unverified sender must never populate trusted extractedState');
    assert.equal(saved.needsSenderReview, true);
    assert.equal(saved.status, 'WAITING_REPLY', 'status must not advance from an unverified message');
  });

  it('I. a verified reply with a bank-detail change routes the Case to SECURITY_REVIEW via the full service path', async () => {
    const sentCase: Case = {
      ...freshCase(),
      status: 'WAITING_REPLY',
      externalThreadId: 'thread-1',
      allowedCounterpartyEmails: ['kurt@acme.example'],
    };
    const { service, repo } = makeService(sentCase);

    (GmailClient as any).getProfile = async () => ({ emailAddress: 'alex@mycompany.example' });
    (GmailClient as any).getThread = async () => ({
      id: 'thread-1',
      messages: [
        {
          id: 'reply-bank-change',
          from: 'Kurt Vance <kurt@acme.example>',
          subject: 'Re: PO #511',
          body: 'Our bank account has changed. Please wire the balance to our new IBAN US98BANK00012345678901.',
        },
      ],
    });

    const result = await service.syncThreadReplies({ caseId: sentCase.id, accessToken: 'fake-token' });
    assert.equal(result.success, true);
    const saved = repo.getById(sentCase.id)!;
    assert.equal(saved.status, 'SECURITY_REVIEW');

    const blockedResolve = service.acceptCredit({ caseId: sentCase.id, approvedBy: 'alex@mycompany.example' });
    assert.equal(blockedResolve.success, false);
    assert.match(blockedResolve.reason || '', /SECURITY_REVIEW_REQUIRED/);

    const ackResolve = service.acceptCredit({
      caseId: sentCase.id,
      approvedBy: 'alex@mycompany.example',
      securityReviewAcknowledged: true,
    });
    assert.equal(ackResolve.success, true);
    assert.equal(ackResolve.case.status, 'RESOLVED');
  });

  it('L. re-syncing an already-processed thread reports zero new replies', async () => {
    const sentCase: Case = {
      ...freshCase(),
      status: 'WAITING_REPLY',
      externalThreadId: 'thread-1',
      allowedCounterpartyEmails: ['kurt@acme.example'],
    };
    const { service } = makeService(sentCase);

    (GmailClient as any).getProfile = async () => ({ emailAddress: 'alex@mycompany.example' });
    (GmailClient as any).getThread = async () => ({
      id: 'thread-1',
      messages: [
        { id: 'reply-1', from: 'Kurt Vance <kurt@acme.example>', subject: 'Re: PO #511', body: 'New ETA is Friday.' },
      ],
    });

    const first = await service.syncThreadReplies({ caseId: sentCase.id, accessToken: 'fake-token' });
    assert.equal(first.newRepliesCount, 1);

    const second = await service.syncThreadReplies({ caseId: sentCase.id, accessToken: 'fake-token' });
    assert.equal(second.newRepliesCount, 0);
  });
});

// ---------------------------------------------------------------------------
// K. demo reset must never delete real Case data (static regression guard)
// ---------------------------------------------------------------------------

describe('K. demo reset vs real Case reset separation', () => {
  it('no frontend code path other than an explicit admin action calls ApiClient.resetCases()', () => {
    const worldContextSrc = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'context', 'WorldContext.tsx'),
      'utf8'
    );
    assert.ok(
      !worldContextSrc.includes('ApiClient.resetCases('),
      'resetDemo() (or any other WorldContext function) must never call ApiClient.resetCases() — ' +
        'demo world resets must never delete real Case data'
    );
  });
});
