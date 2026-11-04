import cors from 'cors';
import express from 'express';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';

// Builds the Express app without starting it, so tests can call it directly.
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
