/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Try loading firebase-applet-config.json for oAuthClientId
let defaultOAuthClientId = '';
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    defaultOAuthClientId = parsed.oAuthClientId || '';
  }
} catch {
  // Ignore
}

const isTestMode = process.env.NODE_ENV === 'test';

// CORS allowlist: in production, only APP_URL (and any comma-separated
// ALLOWED_ORIGINS) may call the API. In development, common localhost dev
// ports are allowed. Never falls back to a wildcard origin.
//
// On Vercel, the frontend and this API are served from the SAME origin
// (see vercel.json's /api rewrite), so that origin must always be allowed
// even if the user hasn't set APP_URL yet — otherwise the app's own
// frontend gets rejected by its own CORS policy. Vercel always injects
// VERCEL_PROJECT_PRODUCTION_URL (the stable production domain) and
// VERCEL_URL (the current deployment's own URL, changes per deploy); both
// are trusted as self-origins automatically. APP_URL/ALLOWED_ORIGINS still
// take precedence for a custom domain or a split frontend/API deployment.
const appUrl = process.env.APP_URL || '';
const vercelSelfOrigins = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

// Redis connection for the serverless (Vercel) deployment target. Accepts
// either the Upstash-native env var names or the legacy Vercel KV names
// (several Vercel Marketplace Redis integrations still inject these) so
// this works regardless of which integration provisioned the store.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isTestMode,
  geminiApiKey: isTestMode ? '' : process.env.GEMINI_API_KEY || '',
  oauthClientId: process.env.GOOGLE_CLIENT_ID || defaultOAuthClientId,
  dataDir: path.resolve(process.cwd(), '.data'),
  casesFilePath: path.resolve(process.cwd(), '.data', 'cases.json'),
  redisUrl,
  redisToken,
  /**
   * true when a Redis store is configured — selects the serverless-safe
   * Case persistence + distributed send lock (server/cases/createCaseRepository.ts,
   * server/locks/createSendLock.ts). false falls back to file-backed
   * persistence + an in-process lock, which is what local dev and the test
   * suite always use (test mode never sets these env vars).
   */
  useRedis: Boolean(redisUrl && redisToken) && !isTestMode,
  appUrl,
  allowedOrigins: Array.from(
    new Set([
      ...(appUrl ? [appUrl] : []),
      ...vercelSelfOrigins,
      ...extraOrigins,
      ...(process.env.NODE_ENV !== 'production' ? devOrigins : []),
    ])
  ),
};
