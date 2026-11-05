import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import disputeRoutes from './routes/disputes.js';
import offerRoutes from './routes/offers.js';
import slotRoutes from './routes/slots.js';
import walletRoutes from './routes/wallet.js';

// Builds the Express app without starting it, so tests can call it directly.
export function createApp() {
  const app = express();

  // Hosting platforms put a proxy in front of the app; trust it so rate
  // limiting sees the real visitor IP instead of the proxy's.
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(helmet()); // sensible security headers
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  // Slow down password guessing: 20 login/signup attempts per 15 minutes per IP.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skip: () => config.isTest,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/slots', slotRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/disputes', disputeRoutes);
  app.use('/api/admin', adminRoutes);

  // In production the same server also hosts the React website. Any
  // non-API page (e.g. /dashboard) gets index.html and React Router takes over.
  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
