/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from './types';

/**
 * Deterministically selects the "active" Case out of a full set: the most
 * recently updated non-terminal (not RESOLVED, not FAILED) Case. Falls back
 * to the most recently updated Case of any status if every Case is
 * terminal. Ties on updatedAt break on createdAt, then on id (descending).
 *
 * Pure and storage-agnostic so every CaseRepository implementation (file-
 * backed for local dev/tests, Redis-backed for a serverless deployment)
 * shares the exact same, testable selection semantics instead of each
 * reimplementing (and potentially diverging on) the tie-break rules.
 */
export function selectActiveCase(cases: Case[]): Case | undefined {
  const nonTerminal = cases.filter((c) => c.status !== 'RESOLVED' && c.status !== 'FAILED');
  const pool = nonTerminal.length > 0 ? nonTerminal : cases;
  if (pool.length === 0) return undefined;

  return [...pool].sort((a, b) => {
    const updatedDelta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;
    const createdDelta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (createdDelta !== 0) return createdDelta;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  })[0];
}
