import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { connectDb, disconnectDb } from '../../src/db.js';

beforeAll(async () => {
  await connectDb(inject('mongoUri'), { dbName: 'skillswap-test' });
});

// Start every test with empty collections. This uses the raw MongoDB driver
// because our own models refuse to delete ledger entries (append-only).
beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await disconnectDb();
});
