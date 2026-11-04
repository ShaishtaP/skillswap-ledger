// All settings come from environment variables, so the same code runs on a
// laptop, in tests and in production with different values.
const isTest = process.env.NODE_ENV === 'test';

function required(name, testDefault) {
  const value = process.env[name] ?? (isTest ? testDefault : undefined);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: required('JWT_SECRET', 'test-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Every new user starts with 2 hours so they can book before they teach.
  signupGrantMinutes: 120,
};
