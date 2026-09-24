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
  DemoEngine,
  createDemoEngine,
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

describe('Live Engine & Same-Tick Race Protection (WorldContext Action Semantics)', () => {
  it('6. Same-tick duplicate approvePayment: balance decreases once, exactly one event created', () => {
    const liveEngine = new (class {
      private domainEngine = new DemoEngine();

      approvePayment(id: string) {
        return this.domainEngine.approvePayment(id);
      }
      getState() {
        return this.domainEngine.getState();
      }
    })();

    const initialBalance = liveEngine.getState().treasuryBalance;
    const initialEvents = liveEngine.getState().realityEvents.length;

    // Simulate same-tick invocations before any React re-render:
    // approvePayment('inv-511');
    // approvePayment('inv-511');
    const first = liveEngine.approvePayment('inv-511');
    const second = liveEngine.approvePayment('inv-511');

    assert.equal(first.result.success, true);
    assert.ok(first.eventCreated, 'First call must create an event');
    assert.equal(first.result.balance, initialBalance - 418.0);

    assert.equal(second.result.success, false, 'Second call must be rejected');
    assert.equal(second.result.reason, 'ALREADY_PAID');
    assert.equal(second.eventCreated, undefined, 'Second call must NOT create a duplicate event');

    const finalState = liveEngine.getState();
    assert.equal(finalState.treasuryBalance, initialBalance - 418.0, 'Balance must decrease once only');
    assert.equal(finalState.realityEvents.length, initialEvents + 1, 'Exactly one reality event added');
    assert.equal(finalState.invoices.find((i: any) => i.id === 'inv-511')?.status, 'PAID');
  });

  it('7. Same-tick duplicate mergePullRequest: merges once, exactly one event created', () => {
    const engine = new DemoEngine();
    const initialEvents = engine.getState().realityEvents.length;

    // Simulate same-tick duplicate calls:
    // mergePullRequest('pr-184');
    // mergePullRequest('pr-184');
    const first = engine.mergePullRequest('pr-184');
    const second = engine.mergePullRequest('pr-184');

    assert.equal(first.result.success, true);
    assert.ok(first.eventCreated, 'First call creates merge event');
    assert.equal(second.result.success, false, 'Second call must be rejected');
    assert.equal(second.result.reason, 'ALREADY_MERGED');
    assert.equal(second.eventCreated, undefined, 'Second call must NOT create an event');

    const finalState = engine.getState();
    assert.equal(finalState.pullRequests.find((p: any) => p.id === 'pr-184')?.status, 'MERGED');
    assert.equal(finalState.realityEvents.length, initialEvents + 1, 'Exactly one reality event added');
  });

  it('8. Same-tick duplicate startWorkflow: starts only one workflow run', () => {
    const engine = new DemoEngine();

    // Simulate same-tick duplicate workflow starts:
    // startMayaAcmeWorkflow();
    // startMayaAcmeWorkflow();
    const first = engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Preparing supplier inquiry');
    const second = engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Duplicate attempt');

    assert.equal(first.result.started, true);
    assert.ok(first.result.runId);
    assert.equal(second.result.started, false, 'Second attempt must be rejected');
    assert.equal(second.result.reason, 'ALREADY_RUNNING');
    assert.equal(second.result.runId, first.result.runId);

    const finalState = engine.getState();
    assert.equal(finalState.workflows.MAYA_ACME_SHIPMENT?.status, 'RUNNING');
    assert.equal(finalState.workflows.MAYA_ACME_SHIPMENT?.stepLabel, 'Preparing supplier inquiry');
  });

  it('9. Reset Demo clears synchronous locks & state: operations can run once again', () => {
    const engine = new DemoEngine();

    // Run operations to alter state
    engine.approvePayment('inv-511');
    engine.mergePullRequest('pr-184');
    engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Running');

    assert.equal(engine.getState().invoices[0].status, 'PAID');
    assert.equal(engine.getState().pullRequests[0].status, 'MERGED');
    assert.equal(engine.getState().workflows.MAYA_ACME_SHIPMENT?.status, 'RUNNING');

    // Reset Demo
    engine.reset();

    // Verify critical state restored
    const stateAfterReset = engine.getState();
    assert.equal(stateAfterReset.treasuryBalance, 128450);
    assert.equal(stateAfterReset.invoices.find((i: any) => i.id === 'inv-511')?.status, 'PENDING_APPROVAL');
    assert.equal(stateAfterReset.pullRequests.find((p: any) => p.id === 'pr-184')?.status, 'CHECKS_PASSING');
    assert.equal(stateAfterReset.workflows.MAYA_ACME_SHIPMENT, undefined);

    // After reset, payment can run once again
    const postResetPayment1 = engine.approvePayment('inv-511');
    assert.equal(postResetPayment1.result.success, true);
    // Duplicate payment in same tick is still safely blocked
    const postResetPayment2 = engine.approvePayment('inv-511');
    assert.equal(postResetPayment2.result.success, false);
    assert.equal(postResetPayment2.result.reason, 'ALREADY_PAID');

    // After reset, PR can merge once again
    const postResetPR1 = engine.mergePullRequest('pr-184');
    assert.equal(postResetPR1.result.success, true);
    const postResetPR2 = engine.mergePullRequest('pr-184');
    assert.equal(postResetPR2.result.success, false);
    assert.equal(postResetPR2.result.reason, 'ALREADY_MERGED');

    // After reset, workflow can start once again
    const postResetWF1 = engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'New run');
    assert.equal(postResetWF1.result.started, true);
    const postResetWF2 = engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Duplicate');
    assert.equal(postResetWF2.result.started, false);
    assert.equal(postResetWF2.result.reason, 'ALREADY_RUNNING');
  });

  it('10. Exact WorldContext action layer simulation: avoids closure race conditions', () => {
    const engine = new DemoEngine();

    // Simulate WorldContext state setters and event dispatching
    let liveTreasuryBalance = 128450;
    const emittedEvents: any[] = [];

    const liveApprovePayment = (invoiceId: string) => {
      const { result, eventCreated, nextState } = engine.approvePayment(invoiceId);
      if (!result.success) {
        return result;
      }
      liveTreasuryBalance = nextState.treasuryBalance;
      if (eventCreated) {
        emittedEvents.push(eventCreated);
      }
      return result;
    };

    // Rapid double-invocation (same tick before any UI re-render)
    const call1 = liveApprovePayment('inv-511');
    const call2 = liveApprovePayment('inv-511');

    assert.equal(call1.success, true);
    assert.equal(call2.success, false);
    assert.equal(call2.reason, 'ALREADY_PAID');
    assert.equal(liveTreasuryBalance, 128450 - 418.0);
    assert.equal(emittedEvents.length, 1, 'Only one event was pushed to the event stream');
  });
});
