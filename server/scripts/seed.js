// Fills a real database (e.g. your Atlas cluster) with the demo community.
// Usage: npm run seed -- --reset   (--reset is required: it ERASES this app's data first)
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { disconnectDb, initModels } from '../src/db.js';
import { DEMO_DOMAIN, DEMO_PASSWORD, seedDemo } from '../src/seed/demoData.js';
import { fullHealthReport } from '../src/services/invariants.js';

function stop(message) {
  console.error(`\n✋ ${message}\n`);
  process.exit(1);
}

if (!process.argv.includes('--reset')) stop('This erases the SkillSwap data in the database first. Run it with --reset to confirm.');
if (!config.mongoUri) stop('MONGO_URI is not set. Put it in server/.env.');

await mongoose.connect(config.mongoUri);
const db = mongoose.connection.db;
console.log(`Connected to database "${db.databaseName}" on ${mongoose.connection.host}`);

// Guard 1: a connection string without a database name silently uses "test",
// which other projects on the same cluster may be using.
if (db.databaseName === 'test') {
  stop('Your MONGO_URI has no database name, so MongoDB would use "test".\n   Add /skillswap after ".mongodb.net", e.g. ...mongodb.net/skillswap?retryWrites=true');
}

// Guard 2: only ever wipe a database that holds nothing but SkillSwap data.
const ours = new Set(Object.values(mongoose.models).map((model) => model.collection.collectionName));
const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
const foreign = existing.filter((name) => !ours.has(name));
if (foreign.length > 0) {
  stop(`Database "${db.databaseName}" contains collections from another app: ${foreign.join(', ')}.\n   Nothing was deleted. Use a separate database name in MONGO_URI.`);
}

await Promise.all(existing.map((name) => db.collection(name).deleteMany({})));
console.log(`Cleared ${existing.length} SkillSwap collections`);

await initModels();
await seedDemo({ log: console.log });
const health = await fullHealthReport();
console.log(`Ledger health: ${health.ok ? 'OK' : 'PROBLEMS FOUND'}`);
console.log(`\nLog in as any of: aisha, rohan, priya, daniel, meera, kabir, sara, arjun or admin @${DEMO_DOMAIN}`);
console.log(`Password: ${DEMO_PASSWORD}`);
await disconnectDb();
