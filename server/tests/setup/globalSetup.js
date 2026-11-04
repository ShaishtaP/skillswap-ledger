import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Starts a throwaway MongoDB for the whole test run. It must be a replica
// set because our ledger relies on transactions, which need one.
export default async function setup({ provide }) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  provide('mongoUri', replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}
