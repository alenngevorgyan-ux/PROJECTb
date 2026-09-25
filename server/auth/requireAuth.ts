/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { GmailClient } from '../gmail/gmailClient';
import { serverConfig } from '../config';

export interface AuthenticatedRequest extends Request {
  userEmail?: string;
  accessToken?: string;
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.substring(7).trim();
}

/**
 * Lightest reasonable authentication boundary for Case endpoints: the
 * caller must present a Google OAuth access token that Gmail itself
 * accepts (verified via users.getProfile), and the resulting verified
 * mailbox address becomes the request's identity. This is not a full IAM
 * system — it exists only to ensure a random, unauthenticated visitor to a
 * public deployment cannot read or mutate real Case state.
 *
 * In test mode ONLY (NODE_ENV=test), an `x-test-session-email` header may
 * stand in for a verified identity, so the test suite can exercise the
 * authenticated code path without making a real Gmail call.
 */
export async function requireAuthenticatedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (serverConfig.isTestMode) {
    const testEmail = req.header('x-test-session-email');
    if (testEmail) {
      req.userEmail = testEmail;
      req.accessToken = 'test-session-token';
      next();
      return;
    }
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing Authorization Bearer token. Connect Gmail first.',
    });
    return;
  }

  try {
    const profile = await GmailClient.getProfile(token);
    if (!profile.emailAddress) {
      throw new Error('Gmail profile did not return an email address.');
    }
    req.userEmail = profile.emailAddress;
    req.accessToken = token;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired Google OAuth token.',
    });
  }
}
