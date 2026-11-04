import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getBalance, getStatement, userAccount } from '../services/ledger.js';

const router = Router();

// The logged-in user's balance and most recent credit movements.
router.get('/', requireAuth, async (req, res) => {
  const account = userAccount(req.user.id);
  const [balance, entries] = await Promise.all([getBalance(account), getStatement(account)]);
  res.json({ balance, entries });
});

export default router;
