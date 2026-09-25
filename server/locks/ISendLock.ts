/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A mutual-exclusion lock keyed by an arbitrary string (a Case id). Used to
 * ensure two concurrent "approve & send" requests for the same Case cannot
 * both reach the Gmail API.
 *
 * `acquire` must return false (never throw, never block) when the key is
 * already held, and must be safe to call from many separate function
 * instances at once (see RedisSendLock) — a single process's in-memory Set
 * (InMemorySendLock) is NOT sufficient on a serverless platform where
 * concurrent requests may land on different instances with no shared
 * memory.
 */
export interface ISendLock {
  /** Attempts to acquire the lock for `key`. Returns true iff acquired. */
  acquire(key: string): Promise<boolean>;
  /** Releases the lock for `key`. Safe to call even if not held. */
  release(key: string): Promise<void>;
}
