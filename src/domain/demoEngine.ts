/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Character,
  Invoice,
  PullRequest,
  RealityEvent,
  TaskItem,
  IdentityProfile,
  WorkflowType,
  ActiveWorkflowInfo,
  PaymentApprovalResult,
  MergePRResult,
  WorkflowStartResult,
  SupplierCreditResult,
} from '../types/world';
import {
  INITIAL_CHARACTERS,
  INITIAL_IDENTITY,
  INITIAL_INVOICES,
  INITIAL_PULL_REQUESTS,
  INITIAL_REALITY_EVENTS,
  INITIAL_TASKS,
} from '../data/initialData';

export interface DemoWorldState {
  invoices: Invoice[];
  treasuryBalance: number;
  pullRequests: PullRequest[];
  realityEvents: RealityEvent[];
  characters: Character[];
  tasks: TaskItem[];
  identity: IdentityProfile;
  workflows: Record<WorkflowType, ActiveWorkflowInfo | undefined>;
}

export function createInitialDemoState(): DemoWorldState {
  return {
    invoices: JSON.parse(JSON.stringify(INITIAL_INVOICES)),
    treasuryBalance: 128450,
    pullRequests: JSON.parse(JSON.stringify(INITIAL_PULL_REQUESTS)),
    realityEvents: JSON.parse(JSON.stringify(INITIAL_REALITY_EVENTS)),
    characters: JSON.parse(JSON.stringify(INITIAL_CHARACTERS)),
    tasks: JSON.parse(JSON.stringify(INITIAL_TASKS)),
    identity: JSON.parse(JSON.stringify(INITIAL_IDENTITY)),
    workflows: {
      VITEK_ONBOARDING_FIX: undefined,
      MAYA_ACME_SHIPMENT: undefined,
      NOVA_DESIGN_COLLAB: undefined,
      CLOUDWORKS_SUPPORT: undefined,
    },
  };
}

export function createSimulatedRealityEvent(
  event: Omit<RealityEvent, 'id' | 'timestamp'>,
  timeOverride?: string
): RealityEvent {
  const now = new Date();
  const timeStr =
    timeOverride ??
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timeStr,
  };
}

/**
 * IDEMPOTENT: approvePayment
 * If invoice is already PAID or does not exist:
 * - Does NOT decrement balance
 * - Does NOT add another RealityEvent
 * - Returns success: false
 */
export function executeApprovePayment(
  state: DemoWorldState,
  invoiceId: string
): { nextState: DemoWorldState; result: PaymentApprovalResult; eventCreated?: RealityEvent } {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'INVOICE_NOT_FOUND',
        balance: state.treasuryBalance,
        invoiceId,
      },
    };
  }

  if (invoice.status === 'PAID') {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'ALREADY_PAID',
        balance: state.treasuryBalance,
        invoiceId,
      },
    };
  }

  if (state.treasuryBalance < invoice.amount) {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'TREASURY_INSUFFICIENT',
        balance: state.treasuryBalance,
        invoiceId,
      },
    };
  }

  const newBalance = Math.round((state.treasuryBalance - invoice.amount) * 100) / 100;
  const updatedInvoices = state.invoices.map((inv) =>
    inv.id === invoiceId ? { ...inv, status: 'PAID' as const } : inv
  );

  const event = createSimulatedRealityEvent({
    agentId: 'founder',
    agentName: 'Alex Founder',
    worldAction: `Founder approved simulated payment for ${invoice.vendorName} ${invoice.invoiceNumber} ($${invoice.amount.toFixed(2)})`,
    businessEvent: `Demo approval credential #8842 authorized simulated payment from Treasury balance (New balance: $${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
    category: 'FINANCE',
    relatedEntityId: invoiceId,
  });

  return {
    nextState: {
      ...state,
      treasuryBalance: newBalance,
      invoices: updatedInvoices,
      realityEvents: [event, ...state.realityEvents],
    },
    result: {
      success: true,
      balance: newBalance,
      invoiceId,
    },
    eventCreated: event,
  };
}

/**
 * IDEMPOTENT: mergePullRequest
 * If PR is already MERGED or does not exist:
 * - Does NOT create another RealityEvent
 * - Does NOT trigger duplicate simulated deployment
 * - Returns success: false
 */
export function executeMergePullRequest(
  state: DemoWorldState,
  prId: string
): { nextState: DemoWorldState; result: MergePRResult; eventCreated?: RealityEvent } {
  const pr = state.pullRequests.find((p) => p.id === prId);
  if (!pr) {
    return {
      nextState: state,
      result: { success: false, reason: 'PR_NOT_FOUND', prId },
    };
  }

  if (pr.status === 'MERGED') {
    return {
      nextState: state,
      result: { success: false, reason: 'ALREADY_MERGED', prId },
    };
  }

  const updatedPRs = state.pullRequests.map((p) =>
    p.id === prId ? { ...p, status: 'MERGED' as const } : p
  );

  const event = createSimulatedRealityEvent({
    agentId: 'founder',
    agentName: 'Alex Founder',
    worldAction: `Founder merged PR #${pr.number} in demo repository`,
    businessEvent: 'Simulated CI build and deployment completed successfully (commit #a7f920b)',
    category: 'DEV',
    relatedEntityId: prId,
  });

  return {
    nextState: {
      ...state,
      pullRequests: updatedPRs,
      realityEvents: [event, ...state.realityEvents],
    },
    result: { success: true, prId },
    eventCreated: event,
  };
}

/**
 * PREVENT DUPLICATES: startWorkflow
 * If a workflow of the same type is already RUNNING, rejects the attempt.
 */
export function executeStartWorkflow(
  state: DemoWorldState,
  type: WorkflowType,
  totalSteps: number,
  initialLabel: string
): { nextState: DemoWorldState; result: WorkflowStartResult } {
  const current = state.workflows[type];
  if (current && current.status === 'RUNNING') {
    return {
      nextState: state,
      result: { started: false, reason: 'ALREADY_RUNNING', type, runId: current.runId },
    };
  }

  const runId = `${type.toLowerCase().replace(/_/g, '-')}-${Date.now()}`;
  const workflowInfo: ActiveWorkflowInfo = {
    runId,
    type,
    status: 'RUNNING',
    currentStep: 1,
    totalSteps,
    stepLabel: initialLabel,
    startedAt: Date.now(),
  };

  return {
    nextState: {
      ...state,
      workflows: {
        ...state.workflows,
        [type]: workflowInfo,
      },
    },
    result: { started: true, runId, type },
  };
}

export function executeUpdateWorkflowStep(
  state: DemoWorldState,
  type: WorkflowType,
  runId: string,
  step: number,
  stepLabel: string,
  status: 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED'
): DemoWorldState {
  const current = state.workflows[type];
  if (!current || current.runId !== runId) {
    return state;
  }

  return {
    ...state,
    workflows: {
      ...state.workflows,
      [type]: {
        ...current,
        currentStep: step,
        stepLabel,
        status,
      },
    },
  };
}

export function executeCompleteWorkflow(
  state: DemoWorldState,
  type: WorkflowType,
  runId?: string
): DemoWorldState {
  const current = state.workflows[type];
  if (!current || (runId && current.runId !== runId)) {
    return state;
  }

  return {
    ...state,
    workflows: {
      ...state.workflows,
      [type]: {
        ...current,
        status: 'COMPLETED',
      },
    },
  };
}

/**
 * IDEMPOTENT: executeAcceptSupplierCredit
 * Transitions invoice from initial amount ($818) to revised amount ($418) by applying credit ($400).
 * If credit is already applied:
 * - Does NOT add second credit item
 * - Does NOT reduce amount again
 * - Does NOT emit duplicate RealityEvent
 * - Returns success: false, reason: 'CREDIT_ALREADY_APPLIED'
 */
export function executeAcceptSupplierCredit(
  state: DemoWorldState,
  invoiceId: string = 'inv-511',
  creditAmount: number = 400.0
): {
  nextState: DemoWorldState;
  result: SupplierCreditResult;
  eventCreated?: RealityEvent;
} {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'INVOICE_NOT_FOUND',
        invoiceId,
      },
    };
  }

  // Idempotency: check if credit line item already exists
  const hasCredit = invoice.items.some(
    (item) => item.unitPrice < 0 || item.description.toLowerCase().includes('credit')
  );
  if (hasCredit) {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'CREDIT_ALREADY_APPLIED',
        invoiceId,
        previousAmount: invoice.amount,
        newAmount: invoice.amount,
        creditApplied: 0,
      },
    };
  }

  if (invoice.status === 'PAID') {
    return {
      nextState: state,
      result: {
        success: false,
        reason: 'INVOICE_ALREADY_PAID',
        invoiceId,
        previousAmount: invoice.amount,
        newAmount: invoice.amount,
      },
    };
  }

  const previousAmount = invoice.amount;
  const newAmount = Math.max(0, Math.round((previousAmount - creditAmount) * 100) / 100);

  const updatedInvoice: Invoice = {
    ...invoice,
    amount: newAmount,
    items: [
      ...invoice.items,
      {
        description: 'Customs Delay Courtesy Credit (Agreed via Email Rail Demo)',
        quantity: 1,
        unitPrice: -creditAmount,
      },
    ],
  };

  const event = createSimulatedRealityEvent({
    agentId: 'maya',
    agentName: 'Maya',
    worldAction: `Maya accepted $${creditAmount.toFixed(2)} courtesy credit for customs delay`,
    businessEvent: `Revised Acme Invoice ${invoice.invoiceNumber} down to $${newAmount.toFixed(2)}; pending founder signature`,
    category: 'FINANCE',
    relatedEntityId: invoiceId,
  });

  const updatedState: DemoWorldState = {
    ...state,
    invoices: state.invoices.map((inv) => (inv.id === invoiceId ? updatedInvoice : inv)),
    realityEvents: [event, ...state.realityEvents.slice(0, 40)],
  };

  return {
    nextState: updatedState,
    result: {
      success: true,
      invoiceId,
      previousAmount,
      newAmount,
      creditApplied: creditAmount,
    },
    eventCreated: event,
  };
}

/**
 * Synchronous authoritative engine for demo actions.
 * Guarantees atomicity and idempotency even during same-tick / same-render duplicate invocations.
 */
export class DemoEngine {
  private state: DemoWorldState;

  constructor(initialState?: DemoWorldState) {
    this.state = initialState ? JSON.parse(JSON.stringify(initialState)) : createInitialDemoState();
  }

  public getState(): Readonly<DemoWorldState> {
    return this.state;
  }

  public approvePayment(invoiceId: string): {
    result: PaymentApprovalResult;
    eventCreated?: RealityEvent;
    nextState: DemoWorldState;
  } {
    const res = executeApprovePayment(this.state, invoiceId);
    if (res.result.success) {
      this.state = res.nextState;
    }
    return { ...res, nextState: this.state };
  }

  public mergePullRequest(prId: string): {
    result: MergePRResult;
    eventCreated?: RealityEvent;
    nextState: DemoWorldState;
  } {
    const res = executeMergePullRequest(this.state, prId);
    if (res.result.success) {
      this.state = res.nextState;
    }
    return { ...res, nextState: this.state };
  }

  public acceptSupplierCredit(
    invoiceId: string = 'inv-511',
    creditAmount: number = 400.0
  ): {
    result: SupplierCreditResult;
    eventCreated?: RealityEvent;
    nextState: DemoWorldState;
  } {
    const res = executeAcceptSupplierCredit(this.state, invoiceId, creditAmount);
    if (res.result.success) {
      this.state = res.nextState;
    }
    return { ...res, nextState: this.state };
  }

  public startWorkflow(
    type: WorkflowType,
    totalSteps: number,
    initialLabel: string
  ): { result: WorkflowStartResult; nextState: DemoWorldState } {
    const res = executeStartWorkflow(this.state, type, totalSteps, initialLabel);
    if (res.result.started) {
      this.state = res.nextState;
    }
    return { ...res, nextState: this.state };
  }

  public updateWorkflowStep(
    type: WorkflowType,
    runId: string,
    step: number,
    stepLabel: string,
    status: 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED'
  ): DemoWorldState {
    this.state = executeUpdateWorkflowStep(this.state, type, runId, step, stepLabel, status);
    return this.state;
  }

  public completeWorkflow(type: WorkflowType, runId?: string): DemoWorldState {
    this.state = executeCompleteWorkflow(this.state, type, runId);
    return this.state;
  }

  public updateInvoice(invoiceId: string, updater: (inv: Invoice) => Invoice): DemoWorldState {
    this.state = {
      ...this.state,
      invoices: this.state.invoices.map((inv) => (inv.id === invoiceId ? updater(inv) : inv)),
    };
    return this.state;
  }

  public addRealityEvent(event: RealityEvent): DemoWorldState {
    this.state = {
      ...this.state,
      realityEvents: [event, ...this.state.realityEvents.slice(0, 40)],
    };
    return this.state;
  }

  public reset(): DemoWorldState {
    this.state = createInitialDemoState();
    return this.state;
  }
}

export function createDemoEngine(initialState?: DemoWorldState): DemoEngine {
  return new DemoEngine(initialState);
}

