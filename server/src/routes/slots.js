import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { bookSlot } from '../services/bookings.js';
import { closeSlot } from '../services/offers.js';

const router = Router();

router.post('/:id/book', requireAuth, async (req, res) => {
  res.status(201).json({ booking: await bookSlot(req.user.id, req.params.id) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  res.json({ slot: await closeSlot(req.user.id, req.params.id) });
});

export default router;
