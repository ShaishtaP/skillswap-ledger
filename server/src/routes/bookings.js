import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { parseQuery, validateBody } from '../middleware/validate.js';
import { BOOKING_STATUSES } from '../models/index.js';
import { cancelBooking, confirmAttendance, getBooking, listBookings } from '../services/bookings.js';
import { getCallInfo } from '../services/calls.js';
import { openDispute } from '../services/disputes.js';

const router = Router();
router.use(requireAuth);

const listSchema = z.object({
  role: z.enum(['learner', 'teacher']).optional(),
  // ?status=BOOKED,DISPUTED
  status: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.enum(BOOKING_STATUSES)))
    .optional(),
  q: z.string().max(100).optional(),
});
const disputeSchema = z.object({ reason: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(2000) });

router.get('/', async (req, res) => {
  res.json({ bookings: await listBookings(req.user.id, parseQuery(listSchema, req.query)) });
});

router.get('/:id', async (req, res) => {
  res.json({ booking: await getBooking(req.user, req.params.id) });
});

// Video call window and who has been on the call so far.
router.get('/:id/call', async (req, res) => {
  res.json(await getCallInfo(req.user, req.params.id));
});

router.post('/:id/confirm', async (req, res) => {
  res.json({ booking: await confirmAttendance(req.user.id, req.params.id) });
});

router.post('/:id/cancel', async (req, res) => {
  res.json({ booking: await cancelBooking(req.user.id, req.params.id) });
});

router.post('/:id/dispute', validateBody(disputeSchema), async (req, res) => {
  res.status(201).json({ dispute: await openDispute(req.user.id, req.params.id, req.body.reason) });
});

export default router;
