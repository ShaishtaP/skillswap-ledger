// Fills a real database (e.g. your Atlas cluster) with the demo community.
// Usage: npm run seed -- --reset   (--reset is required: it ERASES all data first)
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { DEMO_DOMAIN, DEMO_PASSWORD, seedDemo } from '../src/seed/demoData.js';
import { fullHealthReport } from '../src/services/invariants.js';

if (!process.argv.includes('--reset')) {
  console.error('This erases every collection in the database first. Run it with --reset to confirm.');
  process.exit(1);
}
if (!config.mongoUri) {
  console.error('MONGO_URI is not set.');
  process.exit(1);
}

await connectDb(config.mongoUri);
const collections = await mongoose.connection.db.collections();
await Promise.all(collections.map((c) => c.deleteMany({})));
console.log(`Cleared ${collections.length} collections`);

await seedDemo({ log: console.log });
const health = await fullHealthReport();
console.log(`Ledger health: ${health.ok ? 'OK' : 'PROBLEMS FOUND'}`);
console.log(`\nLog in as any of: aisha, rohan, priya, daniel, meera, kabir, sara, arjun or admin @${DEMO_DOMAIN}`);
console.log(`Password: ${DEMO_PASSWORD}`);
await disconnectDb();
