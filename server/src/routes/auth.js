import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { User } from '../models/index.js';
import { login, signup } from '../services/auth.js';
import { AppError } from '../utils/errors.js';

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

const loginSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

router.post('/signup', validateBody(signupSchema), async (req, res) => {
  const { user, token } = await signup(req.body);
  res.status(201).json({ user, token });
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { user, token } = await login(req.body);
  res.json({ user, token });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  res.json({ user });
});

export default router;
