import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseQuery, validateBody } from '../middleware/validate.js';
import { adminResolve, getDispute, listDisputes } from '../services/disputes.js';
import { fullHealthReport, platformStats } from '../services/invariants.js';
import { minutesField } from './schemas.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const listSchema = z.object({ status: z.enum(['OPEN', 'RESOLVED']).optional() });
const resolveSchema = z.object({
  learnerRefund: minutesField,
  note: z.string().trim().max(500).optional(),
});

router.get('/disputes', async (req, res) => {
  res.json({ disputes: await listDisputes(parseQuery(listSchema, req.query)) });
});

router.post('/disputes/:id/resolve', validateBody(resolveSchema), async (req, res) => {
  await adminResolve(req.user.id, req.params.id, req.body.learnerRefund, req.body.note);
  res.json({ dispute: await getDispute(req.user, req.params.id) });
});

// Runs every ledger and escrow check. Used by the admin dashboard.
router.get('/health', async (_req, res) => {
  res.json(await fullHealthReport());
});

router.get('/stats', async (_req, res) => {
  res.json(await platformStats());
});

export default router;
