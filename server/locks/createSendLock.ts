/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverConfig } from '../config';
import { ISendLock } from './ISendLock';
import { InMemorySendLock } from './inMemorySendLock';
import { RedisSendLock } from './redisSendLock';
import { getRedisClient } from '../redisClient';

/**
 * Picks the send lock for the environment this process is running in — see
 * createCaseRepository.ts for the same reasoning. An in-process Set is
 * pointless on Vercel (each invocation may be a different instance with no
 * shared memory), so this must track serverConfig.useRedis exactly the same
 * way the repository factory does.
 */
export function createSendLock(): ISendLock {
  if (serverConfig.useRedis) {
    return new RedisSendLock(getRedisClient());
  }
  return new InMemorySendLock();
}
