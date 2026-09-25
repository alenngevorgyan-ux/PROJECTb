/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Redis } from '@upstash/redis';
import { ISendLock } from './ISendLock';

const LOCK_PREFIX = 'bw:sendlock:';
const LOCK_TTL_SECONDS = 30; // auto-expires so a crashed function can't wedge a Case forever

/**
 * Distributed lock backed by Redis's atomic SET-if-not-exists, safe across
 * however many concurrent serverless function instances Vercel spins up.
 * This is the real fix for send-concurrency on a platform with no shared
 * process memory — InMemorySendLock only protects a single instance.
 */
export class RedisSendLock implements ISendLock {
  constructor(private readonly redis: Redis) {}

  public async acquire(key: string): Promise<boolean> {
    const result = await this.redis.set(LOCK_PREFIX + key, '1', {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });
    return result === 'OK';
  }

  public async release(key: string): Promise<void> {
    await this.redis.del(LOCK_PREFIX + key);
  }
}
