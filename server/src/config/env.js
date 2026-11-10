import path from 'node:path';
import { fileURLToPath } from 'node:url';

// All settings come from environment variables, so the same code runs on a
// laptop, in tests and in production with different values.
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// In production a missing secret is a fatal mistake, so we refuse to start.
// Locally we fall back to a throwaway value so `npm run demo` just works.
function required(name, localDefault) {
  const value = process.env[name] ?? (isProduction ? undefined : localDefault);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  isTest,
  isProduction,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: required('JWT_SECRET', 'local-dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Only needed when the website runs on a different address than the API
  // (local development). In production the API serves the website itself.
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // The built React app. If this folder exists, the API serves it.
  clientDist: path.resolve(here, '../../../client/dist'),
  // Every new user starts with 2 hours so they can book before they teach.
  signupGrantMinutes: 120,
  // How browsers find a route to each other for video calls. STUN (free,
  // public) works for most networks; a TURN relay is needed for strict ones.
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(process.env.TURN_URLS
      ? [{ urls: process.env.TURN_URLS.split(',').map((u) => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }]
      : []),
  ],
};
