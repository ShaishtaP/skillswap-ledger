// Runs the whole app with a temporary in-memory database full of demo data.
// No MongoDB account needed. Everything is wiped when you stop it (Ctrl+C).
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb } from '../src/db.js';
import { startServer } from '../src/httpServer.js';
import { DEMO_DOMAIN, DEMO_PASSWORD, seedDemo } from '../src/seed/demoData.js';

console.log('Starting a temporary database...');
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
await connectDb(replSet.getUri(), { dbName: 'skillswap-demo' });
await seedDemo({ log: (msg) => console.log(`  ${msg}`) });
await startServer();

console.log(`\nDemo accounts: aisha, rohan, priya, daniel, meera, kabir, sara, arjun, admin (@${DEMO_DOMAIN})`);
console.log(`Password for all: ${DEMO_PASSWORD}`);

process.on('SIGINT', async () => {
  await replSet.stop();
  process.exit(0);
});
