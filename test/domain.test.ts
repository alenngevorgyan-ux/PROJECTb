/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDemoState,
  executeApprovePayment,
  executeMergePullRequest,
  executeStartWorkflow,
} from '../src/domain/demoEngine.ts';

describe('Demo Domain Rules & Idempotency', () => {
  it('1. Calling approvePayment twice: balance decreases once only', () => {
    const initialState = createInitialDemoState();
    const initialBalance = initialState.treasuryBalance; // 128450
    const targetInvoice = initialState.invoices[0]; // inv-511, 418.00

    // First call
    const firstCall = executeApprovePayment(initialState, targetInvoice.id);
    assert.equal(firstCall.result.success, true);
    assert.equal(firstCall.nextState.treasuryBalance, initialBalance - targetInvoice.amount);
    const invoiceAfterFirst = firstCall.nextState.invoices.find((i) => i.id === targetInvoice.id);
    assert.equal(invoiceAfterFirst?.status, 'PAID');

    // Second call on already paid invoice
    const secondCall = executeApprovePayment(firstCall.nextState, targetInvoice.id);
    assert.equal(secondCall.result.success, false);
    assert.equal(secondCall.result.reason, 'ALREADY_PAID');
    assert.equal(secondCall.nextState.treasuryBalance, initialBalance - targetInvoice.amount, 'Balance must not decrease a second time');
    assert.equal(secondCall.eventCreated, undefined, 'No duplicate RealityEvent should be created');
  });

  it('2. Calling mergePullRequest twice: one merge only and one merge event only', () => {
    const initialState = createInitialDemoState();
    const initialEventCount = initialState.realityEvents.length;
    const targetPR = initialState.pullRequests[0]; // pr-184

    // First call
    const firstCall = executeMergePullRequest(initialState, targetPR.id);
    assert.equal(firstCall.result.success, true);
    assert.equal(firstCall.nextState.pullRequests[0].status, 'MERGED');
    assert.equal(firstCall.nextState.realityEvents.length, initialEventCount + 1);

    // Second call on already merged PR
    const secondCall = executeMergePullRequest(firstCall.nextState, targetPR.id);
    assert.equal(secondCall.result.success, false);
    assert.equal(secondCall.result.reason, 'ALREADY_MERGED');
    assert.equal(secondCall.nextState.realityEvents.length, initialEventCount + 1, 'RealityEvents count must not increase');
    assert.equal(secondCall.eventCreated, undefined, 'No duplicate event created');
  });

  it('3. Starting Maya workflow twice: only one workflow executes', () => {
    const initialState = createInitialDemoState();

    // Start Maya workflow
    const firstAttempt = executeStartWorkflow(
      initialState,
      'MAYA_ACME_SHIPMENT',
      4,
      'Initiating supplier inquiry'
    );
    assert.equal(firstAttempt.result.started, true);
    assert.ok(firstAttempt.result.runId);
    assert.equal(firstAttempt.nextState.workflows.MAYA_ACME_SHIPMENT?.status, 'RUNNING');

    // Start duplicate Maya workflow while first is still RUNNING
    const secondAttempt = executeStartWorkflow(
      firstAttempt.nextState,
      'MAYA_ACME_SHIPMENT',
      4,
      'Duplicate attempt'
    );
    assert.equal(secondAttempt.result.started, false);
    assert.equal(secondAttempt.result.reason, 'ALREADY_RUNNING');
    assert.equal(secondAttempt.result.runId, firstAttempt.result.runId);
  });

  it('4. Reset demo: restores initial critical state', () => {
    let state = createInitialDemoState();

    // Mutate state with payment, PR merge, and workflow
    state = executeApprovePayment(state, 'inv-511').nextState;
    state = executeMergePullRequest(state, 'pr-184').nextState;
    state = executeStartWorkflow(state, 'VITEK_ONBOARDING_FIX', 5, 'Analyzing').nextState;

    assert.equal(state.invoices[0].status, 'PAID');
    assert.equal(state.pullRequests[0].status, 'MERGED');
    assert.notEqual(state.treasuryBalance, 128450);
    assert.equal(state.workflows.VITEK_ONBOARDING_FIX?.status, 'RUNNING');

    // Reset demo
    const resetState = createInitialDemoState();
    assert.equal(resetState.treasuryBalance, 128450);
    assert.equal(resetState.invoices[0].status, 'PENDING_APPROVAL');
    assert.equal(resetState.pullRequests[0].status, 'CHECKS_PASSING');
    assert.equal(resetState.workflows.VITEK_ONBOARDING_FIX, undefined);
    assert.equal(resetState.realityEvents.length, 3);
  });

  it('5. Already completed operation: does not create another RealityEvent', () => {
    const initialState = createInitialDemoState();
    const eventCountBefore = initialState.realityEvents.length;

    // Approve payment
    const approvedState = executeApprovePayment(initialState, 'inv-511').nextState;
    assert.equal(approvedState.realityEvents.length, eventCountBefore + 1);

    // Call approve again on same invoice
    const duplicateApprove = executeApprovePayment(approvedState, 'inv-511');
    assert.equal(duplicateApprove.nextState.realityEvents.length, eventCountBefore + 1, 'Must not add another event');

    // Call merge PR twice
    const mergedState = executeMergePullRequest(approvedState, 'pr-184').nextState;
    assert.equal(mergedState.realityEvents.length, eventCountBefore + 2);

    const duplicateMerge = executeMergePullRequest(mergedState, 'pr-184');
    assert.equal(duplicateMerge.nextState.realityEvents.length, eventCountBefore + 2, 'Must not add another event');
  });
});
