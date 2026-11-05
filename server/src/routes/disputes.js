import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { acceptProposal, addNote, getDispute, proposeResolution } from '../services/disputes.js';
import { minutesField } from './schemas.js';

const router = Router();
router.use(requireAuth);

const refundSchema = z.object({ learnerRefund: minutesField });
const noteSchema = z.object({ text: z.string().trim().min(1, 'Write something').max(2000) });

router.get('/:id', async (req, res) => {
  res.json({ dispute: await getDispute(req.user, req.params.id) });
});

router.post('/:id/propose', validateBody(refundSchema), async (req, res) => {
  await proposeResolution(req.user.id, req.params.id, req.body.learnerRefund);
  res.json({ dispute: await getDispute(req.user, req.params.id) });
});

router.post('/:id/accept', validateBody(refundSchema), async (req, res) => {
  await acceptProposal(req.user.id, req.params.id, req.body.learnerRefund);
  res.json({ dispute: await getDispute(req.user, req.params.id) });
});

router.post('/:id/notes', validateBody(noteSchema), async (req, res) => {
  await addNote(req.user, req.params.id, req.body.text);
  res.status(201).json({ dispute: await getDispute(req.user, req.params.id) });
});

export default router;
