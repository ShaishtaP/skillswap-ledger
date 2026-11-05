import { config } from './config/env.js';
import { connectDb } from './db.js';
import { startServer } from './httpServer.js';

if (!config.mongoUri) {
  console.error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

await connectDb(config.mongoUri);
await startServer();
