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
const appUrl = process.env.APP_URL || '';
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isTestMode,
  geminiApiKey: isTestMode ? '' : process.env.GEMINI_API_KEY || '',
  oauthClientId: process.env.GOOGLE_CLIENT_ID || defaultOAuthClientId,
  dataDir: path.resolve(process.cwd(), '.data'),
  casesFilePath: path.resolve(process.cwd(), '.data', 'cases.json'),
  appUrl,
  allowedOrigins: Array.from(
    new Set([...(appUrl ? [appUrl] : []), ...extraOrigins, ...(process.env.NODE_ENV !== 'production' ? devOrigins : [])])
  ),
};
