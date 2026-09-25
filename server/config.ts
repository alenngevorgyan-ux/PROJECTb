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

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  oauthClientId: process.env.GOOGLE_CLIENT_ID || defaultOAuthClientId,
  dataDir: path.resolve(process.cwd(), '.data'),
  casesFilePath: path.resolve(process.cwd(), '.data', 'cases.json'),
};
