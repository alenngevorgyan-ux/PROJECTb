/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { GmailClient } from './gmailClient';
import { serverConfig } from '../config';

export const gmailRouter = Router();

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.substring(7).trim();
}

/**
 * GET /api/gmail/status
 */
gmailRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    clientId: serverConfig.oauthClientId,
    configured: Boolean(serverConfig.oauthClientId),
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
});

/**
 * GET /api/gmail/profile
 */
gmailRouter.get('/profile', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing Authorization Bearer token',
      });
    }

    const profile = await GmailClient.getProfile(token);
    res.json({
      success: true,
      email: profile.emailAddress,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to verify Gmail access token',
    });
  }
});
