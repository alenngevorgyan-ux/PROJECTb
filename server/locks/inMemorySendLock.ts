/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ISendLock } from './ISendLock';

/**
 * Single-process lock for local dev, `npm start` on a traditional long-
 * running host, and tests. NOT safe across multiple server instances —
 * see RedisSendLock for the serverless-safe implementation.
 *
 * Correctness here depends on `acquire` performing its check-and-set
 * synchronously (no `await` before the mutation): Node runs an async
 * function's body synchronously up to its first await, so two calls made
 * back-to-back in the same tick (e.g. via Promise.all) still mutate the
 * shared Set in a guaranteed, non-interleaved order.
 */
export class InMemorySendLock implements ISendLock {
  private readonly held: Set<string> = new Set();

  public async acquire(key: string): Promise<boolean> {
    if (this.held.has(key)) return false;
    this.held.add(key);
    return true;
  }

  public async release(key: string): Promise<void> {
    this.held.delete(key);
  }
}
