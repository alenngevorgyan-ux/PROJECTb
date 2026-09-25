/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Redis } from '@upstash/redis';
import { Case } from '../../src/domain/case/types';
import { createInitialSupplierCase } from '../../src/domain/case/stateTransitions';
import { selectActiveCase } from '../../src/domain/case/caseSelection';
import { ICaseRepository } from './ICaseRepository';

const CASE_KEY_PREFIX = 'bw:case:';
const INDEX_KEY = 'bw:case:index'; // Redis SET of all Case ids

/**
 * Case persistence for the serverless (Vercel) deployment target. Every
 * function invocation is a fresh process with no shared memory, so state
 * MUST live in an external store — this is the direct replacement for
 * CaseRepository's file-backed .data/cases.json, safe across however many
 * concurrent instances Vercel runs.
 *
 * Data model: one Redis string per Case (`bw:case:<id>` -> JSON), plus a
 * Redis SET (`bw:case:index`) of all known ids for enumeration. Active-case
 * selection reuses the exact same pure, tested logic as the file-backed
 * repository (src/domain/case/caseSelection.ts) rather than reimplementing
 * — and risking diverging on — the recency/tie-break rules.
 */
export class VercelKvCaseRepository implements ICaseRepository {
  private readonly autoSeed: boolean;

  constructor(
    private readonly redis: Redis,
    options: { autoSeed?: boolean } = {}
  ) {
    this.autoSeed = options.autoSeed ?? true;
  }

  private key(id: string): string {
    return CASE_KEY_PREFIX + id;
  }

  public async getAll(): Promise<Case[]> {
    const ids = await this.redis.smembers(INDEX_KEY);
    if (!ids || ids.length === 0) return [];
    const raw = await Promise.all(ids.map((id) => this.redis.get<Case>(this.key(id))));
    return raw.filter((c): c is Case => Boolean(c));
  }

  public async getById(id: string): Promise<Case | undefined> {
    const c = await this.redis.get<Case>(this.key(id));
    return c ?? undefined;
  }

  public async getActiveCase(): Promise<Case> {
    const all = await this.getAll();
    const active = selectActiveCase(all);
    if (active) return active;

    if (!this.autoSeed) {
      throw new Error('NO_CASES_AVAILABLE');
    }
    return this.seedDefault();
  }

  private async seedDefault(): Promise<Case> {
    const initialCase = createInitialSupplierCase({
      id: 'case-po-511',
      poNumber: '511',
      contactName: 'Kurt Vance (Acme Fabrication Desk)',
      contactEmail: '',
      isReal: true,
    });
    return this.save(initialCase);
  }

  public async save(caseObj: Case): Promise<Case> {
    const saved: Case = { ...caseObj, updatedAt: new Date().toISOString() };
    await this.redis.set(this.key(saved.id), saved);
    await this.redis.sadd(INDEX_KEY, saved.id);
    return saved;
  }

  public async delete(id: string): Promise<boolean> {
    const deletedCount = await this.redis.del(this.key(id));
    await this.redis.srem(INDEX_KEY, id);
    return deletedCount > 0;
  }

  public async reset(): Promise<Case> {
    const ids = await this.redis.smembers(INDEX_KEY);
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => this.redis.del(this.key(id))));
      await this.redis.srem(INDEX_KEY, ...ids);
    }
    const initialCase = createInitialSupplierCase({ id: 'case-po-511', poNumber: '511', isReal: true });
    return this.save(initialCase);
  }
}
