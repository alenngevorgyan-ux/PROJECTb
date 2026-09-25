/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from '../../src/domain/case/types';

/**
 * Storage-agnostic Case persistence contract. Every method is async because
 * the production (Vercel) implementation is Redis-backed (real network
 * I/O) — the local/dev/test file-backed implementation just wraps
 * synchronous fs calls in resolved Promises so both conform to one
 * interface and CaseService never needs to know which one it's talking to.
 */
export interface ICaseRepository {
  getAll(): Promise<Case[]>;
  getById(id: string): Promise<Case | undefined>;
  /** Deterministic selection — see src/domain/case/caseSelection.ts. */
  getActiveCase(): Promise<Case>;
  save(caseObj: Case): Promise<Case>;
  delete(id: string): Promise<boolean>;
  reset(): Promise<Case>;
}
