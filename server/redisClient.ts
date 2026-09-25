/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Redis } from '@upstash/redis';
import { serverConfig } from './config';

let client: Redis | null = null;

/** Lazily constructs the shared Redis client. Only called when serverConfig.useRedis is true. */
export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({ url: serverConfig.redisUrl, token: serverConfig.redisToken });
  }
  return client;
}
