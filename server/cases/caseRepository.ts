/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Case } from '../../src/domain/case/types';
import { createInitialSupplierCase } from '../../src/domain/case/stateTransitions';
import { selectActiveCase } from '../../src/domain/case/caseSelection';
import { serverConfig } from '../config';
import { ICaseRepository } from './ICaseRepository';

export interface CaseRepositoryOptions {
  /**
   * Path to the JSON file backing this repository. Pass `null` explicitly
   * for an in-memory-only repository (no disk I/O at all) — this is what
   * tests should use so they never read or write the developer's real
   * .data/cases.json. Omit to use the production default.
   *
   * NOTE: this is single-process, file-backed persistence — the local dev
   * / test implementation. The Vercel deployment target uses
   * kvCaseRepository.ts (Redis-backed) instead; see
   * server/cases/createCaseRepository.ts.
   */
  filePath?: string | null;
  /** Seed a default PO-511 demo case when the repository starts out empty. Default true. */
  autoSeed?: boolean;
}

/**
 * File-backed (or pure in-memory, for tests) Case persistence. All public
 * methods are async to conform to ICaseRepository even though the
 * underlying fs calls are synchronous — this keeps CaseService storage-
 * agnostic between this and the Redis-backed implementation used in
 * production on Vercel.
 */
export class CaseRepository implements ICaseRepository {
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

  public async getAll(): Promise<Case[]> {
    return Array.from(this.cache.values());
  }

  public async getById(id: string): Promise<Case | undefined> {
    return this.cache.get(id);
  }

  public async getActiveCase(): Promise<Case> {
    const all = await this.getAll();
    const active = selectActiveCase(all);
    if (active) return active;

    if (!this.autoSeed) {
      throw new Error('NO_CASES_AVAILABLE');
    }
    this.seedDefault();
    return this.getActiveCase();
  }

  public async save(caseObj: Case): Promise<Case> {
    const saved: Case = { ...caseObj, updatedAt: new Date().toISOString() };
    this.cache.set(saved.id, saved);
    this.flushToDisk();
    return saved;
  }

  public async delete(id: string): Promise<boolean> {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.flushToDisk();
    }
    return deleted;
  }

  public async reset(): Promise<Case> {
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
