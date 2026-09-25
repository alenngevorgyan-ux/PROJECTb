/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Case } from '../../src/domain/case/types';
import { createInitialSupplierCase } from '../../src/domain/case/stateTransitions';
import { serverConfig } from '../config';

export interface CaseRepositoryOptions {
  /**
   * Path to the JSON file backing this repository. Pass `null` explicitly
   * for an in-memory-only repository (no disk I/O at all) — this is what
   * tests should use so they never read or write the developer's real
   * .data/cases.json. Omit to use the production default.
   *
   * NOTE: this is single-process, file-backed persistence. It has no
   * multi-instance/concurrent-writer safety and is not a durable database —
   * acceptable for a controlled single-process test, not for production
   * scale. See README.md "Known limitations".
   */
  filePath?: string | null;
  /** Seed a default PO-511 demo case when the repository starts out empty. Default true. */
  autoSeed?: boolean;
}

export class CaseRepository {
  private cache: Map<string, Case> = new Map();
  private readonly filePath: string | null;
  private readonly autoSeed: boolean;

  constructor(options: CaseRepositoryOptions = {}) {
    this.filePath = options.filePath === undefined ? serverConfig.casesFilePath : options.filePath;
    this.autoSeed = options.autoSeed ?? true;

    if (this.filePath) {
      this.ensureDirectory();
      this.loadFromDisk();
    } else if (this.autoSeed) {
      this.seedDefault();
    }
  }

  private ensureDirectory() {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directory:', err);
    }
  }

  private loadFromDisk() {
    if (!this.filePath) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const cases: Case[] = JSON.parse(raw);
        this.cache.clear();
        for (const c of cases) {
          this.cache.set(c.id, c);
        }
      } else if (this.autoSeed) {
        this.seedDefault();
      }
    } catch (err) {
      console.error('Error loading cases from disk, falling back to in-memory state:', err);
      if (this.cache.size === 0 && this.autoSeed) {
        const initialCase = createInitialSupplierCase({ id: 'case-po-511', poNumber: '511', isReal: true });
        this.cache.set(initialCase.id, initialCase);
      }
    }
  }

  private seedDefault() {
    const initialCase = createInitialSupplierCase({
      id: 'case-po-511',
      poNumber: '511',
      contactName: 'Kurt Vance (Acme Fabrication Desk)',
      contactEmail: '', // user will supply real email
      isReal: true,
    });
    this.cache.set(initialCase.id, initialCase);
    this.flushToDisk();
  }

  private flushToDisk() {
    if (!this.filePath) return;
    try {
      this.ensureDirectory();
      const cases = Array.from(this.cache.values());
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(cases, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Failed to save cases to disk:', err);
    }
  }

  public getAll(): Case[] {
    return Array.from(this.cache.values());
  }

  public getById(id: string): Case | undefined {
    return this.cache.get(id);
  }

  /**
   * Deterministically selects the "active" Case: the most recently updated
   * non-terminal (not RESOLVED, not FAILED) Case. Falls back to the most
   * recently updated Case of any status if every Case is terminal. Ties on
   * updatedAt break on createdAt, then on id (descending) — never on Map
   * insertion order, which is not guaranteed to reflect recency.
   */
  public getActiveCase(): Case {
    const all = this.getAll();
    const nonTerminal = all.filter((c) => c.status !== 'RESOLVED' && c.status !== 'FAILED');
    const pool = nonTerminal.length > 0 ? nonTerminal : all;

    if (pool.length === 0) {
      if (!this.autoSeed) {
        throw new Error('NO_CASES_AVAILABLE');
      }
      this.seedDefault();
      return this.getActiveCase();
    }

    return this.sortByRecency(pool)[0];
  }

  private sortByRecency(cases: Case[]): Case[] {
    return [...cases].sort((a, b) => {
      const updatedDelta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      if (updatedDelta !== 0) return updatedDelta;
      const createdDelta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      if (createdDelta !== 0) return createdDelta;
      // Final deterministic tie-break: descending id comparison.
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });
  }

  public save(caseObj: Case): Case {
    const saved: Case = { ...caseObj, updatedAt: new Date().toISOString() };
    this.cache.set(saved.id, saved);
    this.flushToDisk();
    return saved;
  }

  public delete(id: string): boolean {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.flushToDisk();
    }
    return deleted;
  }

  public reset(): Case {
    this.cache.clear();
    const initialCase = createInitialSupplierCase({
      id: 'case-po-511',
      poNumber: '511',
      isReal: true,
    });
    this.cache.set(initialCase.id, initialCase);
    this.flushToDisk();
    return initialCase;
  }
}

export const caseRepository = new CaseRepository();
