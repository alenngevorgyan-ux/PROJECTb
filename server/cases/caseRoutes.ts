/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { caseService } from './caseService';

export const caseRouter = Router();

// Helper to extract Bearer token
function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.substring(7).trim();
}

/**
 * GET /api/cases
 */
caseRouter.get('/', (_req: Request, res: Response) => {
  try {
    const cases = caseService.getAllCases();
    res.json({ success: true, cases });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cases/active
 */
caseRouter.get('/active', (_req: Request, res: Response) => {
  try {
    const activeCase = caseService.getActiveCase();
    res.json({ success: true, case: activeCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/create
 */
caseRouter.post('/create', (req: Request, res: Response) => {
  try {
    const { poNumber, contactEmail, contactName, objective } = req.body;
    const newCase = caseService.createSupplierCase({
      poNumber,
      contactEmail,
      contactName,
      objective,
    });
    res.json({ success: true, case: newCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/draft
 */
caseRouter.post('/:id/draft', async (req: Request, res: Response) => {
  try {
    const caseId = req.params.id;
    const { recipient, subject, body } = req.body;
    const updatedCase = await caseService.prepareDraft(caseId, { recipient, subject, body });
    res.json({ success: true, case: updatedCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/send
 */
caseRouter.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const caseId = req.params.id;
    const token = getBearerToken(req);
    const { approvedBy, recipient, subject, body } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing Google OAuth access token. Connect Gmail first.',
      });
    }

    if (!recipient || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Recipient, subject, and body are required to send email.',
      });
    }

    const result = await caseService.approveAndSend({
      caseId,
      accessToken: token,
      approvedBy: approvedBy || 'Alex Founder',
      recipient,
      subject,
      body,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason, case: result.case });
    }

    res.json({ success: true, case: result.case });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/sync
 */
caseRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const caseId = req.params.id;
    const token = getBearerToken(req);
    const { userEmail } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing Google OAuth access token. Connect Gmail first.',
      });
    }

    const result = await caseService.syncThreadReplies({
      caseId,
      accessToken: token,
      userEmail: userEmail || '',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.reason,
        case: result.case,
      });
    }

    res.json({
      success: true,
      case: result.case,
      newRepliesCount: result.newRepliesCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/resolve
 */
caseRouter.post('/:id/resolve', (req: Request, res: Response) => {
  try {
    const caseId = req.params.id;
    const { approvedBy, acceptedCredit, notes } = req.body;

    const result = caseService.acceptCredit({
      caseId,
      approvedBy: approvedBy || 'Alex Founder',
      acceptedCredit,
      notes,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason, case: result.case });
    }

    res.json({ success: true, case: result.case });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/reset
 */
caseRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    const resetCase = caseService.resetCases();
    res.json({ success: true, case: resetCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
