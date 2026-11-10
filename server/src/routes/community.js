import { Router } from 'express';
import { publicStats, recentSwaps } from '../services/community.js';

// Public, read-only numbers for the homepage. No login needed.
const router = Router();

router.get('/stats', async (_req, res) => {
  res.json(await publicStats());
});

router.get('/recent', async (_req, res) => {
  res.json({ swaps: await recentSwaps() });
});

export default router;
