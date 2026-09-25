/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Case } from '../../src/domain/case/types';
import { createInitialSupplierCase } from '../../src/domain/case/stateTransitions';
import { serverConfig } from '../config';

export class CaseRepository {
  private cache: Map<string, Case> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.ensureDirectory();
    this.loadFromDisk();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(serverConfig.dataDir)) {
        fs.mkdirSync(serverConfig.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directory:', err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(serverConfig.casesFilePath)) {
        const raw = fs.readFileSync(serverConfig.casesFilePath, 'utf8');
        const cases: Case[] = JSON.parse(raw);
        this.cache.clear();
        for (const c of cases) {
          this.cache.set(c.id, c);
        }
      } else {
        // Seed default initial supplier case
        this.cache.clear();
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
      this.initialized = true;
    } catch (err) {
      console.error('Error loading cases from disk, fallback to memory:', err);
      if (this.cache.size === 0) {
        const initialCase = createInitialSupplierCase({
          id: 'case-po-511',
          poNumber: '511',
          isReal: true,
        });
        this.cache.set(initialCase.id, initialCase);
      }
      this.initialized = true;
    }
  }

  private flushToDisk() {
    try {
      this.ensureDirectory();
      const cases = Array.from(this.cache.values());
      const tempPath = `${serverConfig.casesFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(cases, null, 2), 'utf8');
      fs.renameSync(tempPath, serverConfig.casesFilePath);
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

  public getActiveCase(): Case {
    const all = this.getAll();
    if (all.length === 0) {
      const initial = createInitialSupplierCase({
        id: 'case-po-511',
        poNumber: '511',
        isReal: true,
      });
      this.save(initial);
      return initial;
    }
    // Return the latest active or first case
    return all[0];
  }

  public save(caseObj: Case): Case {
    caseObj.updatedAt = new Date().toISOString();
    this.cache.set(caseObj.id, caseObj);
    this.flushToDisk();
    return caseObj;
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
