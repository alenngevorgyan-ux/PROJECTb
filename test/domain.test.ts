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
  executeUpdateWorkflowStep,
  executeAcceptSupplierCredit,
  DemoEngine,
  createDemoEngine,
} from '../src/domain/demoEngine.ts';

describe('Demo Domain Rules & Idempotency', () => {
  it('1. Calling approvePayment twice: balance decreases once only', () => {
    const initialState = createInitialDemoState();
    const initialBalance = initialState.treasuryBalance; // 128450
    const targetInvoice = initialState.invoices[0]; // inv-511, 818.00

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
    const invoiceAmount = liveEngine.getState().invoices.find((i) => i.id === 'inv-511')!.amount; // 818.0

    // Simulate same-tick invocations before any React re-render:
    // approvePayment('inv-511');
    // approvePayment('inv-511');
    const first = liveEngine.approvePayment('inv-511');
    const second = liveEngine.approvePayment('inv-511');

    assert.equal(first.result.success, true);
    assert.ok(first.eventCreated, 'First call must create an event');
    assert.equal(first.result.balance, initialBalance - invoiceAmount);

    assert.equal(second.result.success, false, 'Second call must be rejected');
    assert.equal(second.result.reason, 'ALREADY_PAID');
    assert.equal(second.eventCreated, undefined, 'Second call must NOT create a duplicate event');

    const finalState = liveEngine.getState();
    assert.equal(finalState.treasuryBalance, initialBalance - invoiceAmount, 'Balance must decrease once only');
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
    const invAmount = engine.getState().invoices.find((i) => i.id === 'inv-511')!.amount; // 818.0

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
    assert.equal(liveTreasuryBalance, 128450 - invAmount);
    assert.equal(emittedEvents.length, 1, 'Only one event was pushed to the event stream');
  });
});

describe('Supplier Credit & Story State Transitions (Issues 1-6)', () => {
  it('TEST A: Initial Invoice #511 amount === 818, no credit line item', () => {
    const initialState = createInitialDemoState();
    const inv511 = initialState.invoices.find((i) => i.id === 'inv-511');

    assert.ok(inv511, 'Invoice #511 must exist');
    assert.equal(inv511?.amount, 818.0, 'Initial amount must be 818.00');
    assert.equal(inv511?.status, 'PENDING_APPROVAL');
    assert.equal(inv511?.items.length, 1, 'Must contain only 1 item initially');
    assert.equal(inv511?.items[0].description, 'Precision CNC Aluminum Chassis Units (Batch 1)');
    assert.equal(inv511?.items[0].quantity, 2);
    assert.equal(inv511?.items[0].unitPrice, 409.0);

    const hasCredit = inv511?.items.some((item) => item.unitPrice < 0);
    assert.equal(hasCredit, false, 'Initial state must NOT have a credit line item');
  });

  it('TEST B: Accept $400 supplier credit: 818 -> 418, one credit line added', () => {
    const engine = new DemoEngine();
    const initialEvents = engine.getState().realityEvents.length;

    const res = engine.acceptSupplierCredit('inv-511', 400.0);
    assert.equal(res.result.success, true);
    assert.equal(res.result.previousAmount, 818.0);
    assert.equal(res.result.newAmount, 418.0);
    assert.equal(res.result.creditApplied, 400.0);
    assert.ok(res.eventCreated, 'Acceptance event created');

    const state = engine.getState();
    const inv511 = state.invoices.find((i) => i.id === 'inv-511');
    assert.equal(inv511?.amount, 418.0);
    assert.equal(inv511?.items.length, 2);
    assert.equal(inv511?.items[1].unitPrice, -400.0);
    assert.equal(state.realityEvents.length, initialEvents + 1);
  });

  it('TEST C: Accept the credit twice: still 418, only one credit line, only one acceptance event', () => {
    const engine = new DemoEngine();
    const initialEvents = engine.getState().realityEvents.length;

    // First acceptance
    const call1 = engine.acceptSupplierCredit('inv-511', 400.0);
    assert.equal(call1.result.success, true);
    assert.equal(call1.result.newAmount, 418.0);
    assert.ok(call1.eventCreated);

    // Second acceptance (same tick / duplicate call)
    const call2 = engine.acceptSupplierCredit('inv-511', 400.0);
    assert.equal(call2.result.success, false);
    assert.equal(call2.result.reason, 'CREDIT_ALREADY_APPLIED');
    assert.equal(call2.eventCreated, undefined, 'No duplicate event created');

    const state = engine.getState();
    const inv511 = state.invoices.find((i) => i.id === 'inv-511');
    assert.equal(inv511?.amount, 418.0, 'Amount must remain 418.00');
    assert.equal(inv511?.items.length, 2, 'Only one credit line item exists');
    assert.equal(state.realityEvents.length, initialEvents + 1, 'Only one event added to stream');
  });

  it('TEST D: Reset after accepting credit: invoice returns to 818, credit line removed, supplier workflow cleared', () => {
    const engine = new DemoEngine();

    // Start Maya workflow and accept credit
    engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Initiating');
    engine.acceptSupplierCredit('inv-511', 400.0);

    const mutatedState = engine.getState();
    assert.equal(mutatedState.invoices.find((i) => i.id === 'inv-511')?.amount, 418.0);
    assert.equal(mutatedState.workflows.MAYA_ACME_SHIPMENT?.status, 'RUNNING');

    // Reset demo
    engine.reset();

    const resetState = engine.getState();
    const resetInv511 = resetState.invoices.find((i) => i.id === 'inv-511');
    assert.equal(resetInv511?.amount, 818.0, 'Invoice amount must return to 818.00');
    assert.equal(resetInv511?.items.length, 1, 'Credit line item must be removed');
    assert.equal(resetInv511?.status, 'PENDING_APPROVAL');
    assert.equal(resetState.workflows.MAYA_ACME_SHIPMENT, undefined, 'Supplier workflow must be cleared');
  });

  it('TEST E: Supplier reply availability: before supplier-response workflow state reply is unavailable; after it becomes available', () => {
    const engine = new DemoEngine();

    // 1. Initial: Maya has not started workflow
    let workflow = engine.getState().workflows.MAYA_ACME_SHIPMENT;
    let isSupplierResponseAvailable =
      workflow !== undefined && (workflow.currentStep >= 3 || workflow.status === 'COMPLETED');
    assert.equal(isSupplierResponseAvailable, false, 'Supplier response must NOT be available initially');

    // 2. Step 1: Maya starts workflow
    engine.startWorkflow('MAYA_ACME_SHIPMENT', 4, 'Preparing inquiry');
    workflow = engine.getState().workflows.MAYA_ACME_SHIPMENT;
    isSupplierResponseAvailable =
      workflow !== undefined && (workflow.currentStep >= 3 || workflow.status === 'COMPLETED');
    assert.equal(isSupplierResponseAvailable, false, 'Supplier response must NOT be available on step 1');

    // 3. Step 2: Simulated inquiry in flight
    engine.updateWorkflowStep('MAYA_ACME_SHIPMENT', workflow!.runId, 2, 'Awaiting supplier reply', 'RUNNING');
    workflow = engine.getState().workflows.MAYA_ACME_SHIPMENT;
    isSupplierResponseAvailable =
      workflow !== undefined && (workflow.currentStep >= 3 || workflow.status === 'COMPLETED');
    assert.equal(isSupplierResponseAvailable, false, 'Supplier response must NOT be available on step 2');

    // 4. Step 3: Supplier response received
    engine.updateWorkflowStep('MAYA_ACME_SHIPMENT', workflow!.runId, 3, 'Acme credit received', 'RUNNING');
    workflow = engine.getState().workflows.MAYA_ACME_SHIPMENT;
    isSupplierResponseAvailable =
      workflow !== undefined && (workflow.currentStep >= 3 || workflow.status === 'COMPLETED');
    assert.equal(isSupplierResponseAvailable, true, 'Supplier response MUST be available on step 3');

    // 5. Reset: response becomes unavailable again
    engine.reset();
    workflow = engine.getState().workflows.MAYA_ACME_SHIPMENT;
    isSupplierResponseAvailable =
      workflow !== undefined && (workflow.currentStep >= 3 || workflow.status === 'COMPLETED');
    assert.equal(isSupplierResponseAvailable, false, 'Supplier response must be unavailable after reset');
  });

  it('TEST F: Payment after accepted credit: invoice = 418, payment succeeds once, treasury decreases exactly 418, second attempt rejected', () => {
    const engine = new DemoEngine();
    const initialTreasury = engine.getState().treasuryBalance; // 128450

    // Accept credit
    const creditRes = engine.acceptSupplierCredit('inv-511', 400.0);
    assert.equal(creditRes.result.success, true);
    assert.equal(creditRes.result.newAmount, 418.0);
    assert.equal(engine.getState().invoices.find((i) => i.id === 'inv-511')?.amount, 418.0);

    // Pay invoice
    const pay1 = engine.approvePayment('inv-511');
    assert.equal(pay1.result.success, true);
    assert.equal(pay1.result.balance, initialTreasury - 418.0);
    assert.equal(engine.getState().treasuryBalance, initialTreasury - 418.0, 'Balance must decrease by exactly 418.00');
    assert.equal(engine.getState().invoices.find((i) => i.id === 'inv-511')?.status, 'PAID');

    // Second payment attempt
    const pay2 = engine.approvePayment('inv-511');
    assert.equal(pay2.result.success, false);
    assert.equal(pay2.result.reason, 'ALREADY_PAID');
    assert.equal(engine.getState().treasuryBalance, initialTreasury - 418.0, 'Balance must not change on duplicate payment');
  });
});
