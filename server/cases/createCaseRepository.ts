/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverConfig } from '../config';
import { ICaseRepository } from './ICaseRepository';
import { CaseRepository } from './caseRepository';
import { VercelKvCaseRepository } from './kvCaseRepository';
import { getRedisClient } from '../redisClient';

/**
 * Picks the right Case persistence for the environment this process is
 * running in: Redis-backed when a store is configured (the Vercel
 * deployment target — see server/config.ts useRedis), file-backed
 * otherwise (local `npm run dev` / `npm start`, and always in tests, since
 * NODE_ENV=test forces useRedis to false).
 */
export function createCaseRepository(): ICaseRepository {
  if (serverConfig.useRedis) {
    return new VercelKvCaseRepository(getRedisClient());
  }
  return new CaseRepository();
}
