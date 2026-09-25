/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { caseService } from './caseService';
import { requireAuthenticatedUser, AuthenticatedRequest } from '../auth/requireAuth';

export const caseRouter = Router();

// Every Case endpoint requires a verified Google identity — a random,
// unauthenticated visitor to a public deployment must not be able to read
// or mutate real Case state. See server/auth/requireAuth.ts.
caseRouter.use(requireAuthenticatedUser);

/**
 * GET /api/cases
 */
caseRouter.get('/', (_req: AuthenticatedRequest, res: Response) => {
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
caseRouter.get('/active', (_req: AuthenticatedRequest, res: Response) => {
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
caseRouter.post('/create', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { poNumber, contactEmail, contactName, objective } = req.body;
    const newCase = caseService.createSupplierCase({ poNumber, contactEmail, contactName, objective });
    res.json({ success: true, case: newCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/draft
 */
caseRouter.post('/:id/draft', async (req: AuthenticatedRequest, res: Response) => {
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
caseRouter.post('/:id/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    const { recipient, subject, body } = req.body;

    if (!recipient || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Recipient, subject, and body are required to send email.',
      });
    }

    const result = await caseService.approveAndSend({
      caseId,
      accessToken: req.accessToken!,
      approvedBy: req.userEmail!,
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
caseRouter.post('/:id/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;

    const result = await caseService.syncThreadReplies({
      caseId,
      accessToken: req.accessToken!,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason, case: result.case });
    }

    res.json({ success: true, case: result.case, newRepliesCount: result.newRepliesCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cases/:id/resolve
 */
caseRouter.post('/:id/resolve', (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    const { acceptedCredit, notes, securityReviewAcknowledged } = req.body;

    const result = caseService.acceptCredit({
      caseId,
      approvedBy: req.userEmail!,
      acceptedCredit,
      notes,
      securityReviewAcknowledged,
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
 * Resets REAL case data. Distinct from — and never called by — the demo
 * world reset on the frontend. Still gated behind requireAuthenticatedUser
 * above; intended for explicit, confirmed developer/test use only.
 */
caseRouter.post('/reset', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const resetCase = caseService.resetCases();
    res.json({ success: true, case: resetCase });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
