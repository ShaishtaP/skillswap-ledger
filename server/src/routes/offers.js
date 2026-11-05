import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { parseQuery, validateBody } from '../middleware/validate.js';
import { createOffer, createSlot, getOffer, listMyOffers, listOffers, updateOffer } from '../services/offers.js';
import { skillsField } from './schemas.js';

const router = Router();

const offerFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().trim().max(2000).default(''),
  skills: skillsField.default([]),
  durationMinutes: z
    .number()
    .int()
    .min(15, 'At least 15 minutes')
    .max(240, 'At most 4 hours')
    .refine((m) => m % 15 === 0, 'Use steps of 15 minutes'),
};

const createSchema = z.object(offerFields);
const updateSchema = z.object({
  title: offerFields.title.optional(),
  description: z.string().trim().max(2000).optional(),
  skills: skillsField.optional(),
  active: z.boolean().optional(),
});
const listSchema = z.object({
  q: z.string().max(100).optional(),
  skill: z.string().max(30).optional(),
});
const slotSchema = z.object({ startsAt: z.iso.datetime({ offset: true, message: 'Use an ISO date-time' }) });

router.get('/', async (req, res) => {
  res.json({ offers: await listOffers(parseQuery(listSchema, req.query)) });
});

// Must come before '/:id', otherwise Express would treat "mine" as an id.
router.get('/mine', requireAuth, async (req, res) => {
  res.json({ offers: await listMyOffers(req.user.id) });
});

router.get('/:id', async (req, res) => {
  res.json({ offer: await getOffer(req.params.id) });
});

router.post('/', requireAuth, validateBody(createSchema), async (req, res) => {
  res.status(201).json({ offer: await createOffer(req.user.id, req.body) });
});

router.patch('/:id', requireAuth, validateBody(updateSchema), async (req, res) => {
  res.json({ offer: await updateOffer(req.user.id, req.params.id, req.body) });
});

router.post('/:id/slots', requireAuth, validateBody(slotSchema), async (req, res) => {
  res.status(201).json({ slot: await createSlot(req.user.id, req.params.id, req.body.startsAt) });
});

export default router;
