import mongoose from 'mongoose';
import './models/index.js';

export async function connectDb(uri, options = {}) {
  await mongoose.connect(uri, options);
  // Build collections and indexes up front. Our safety guarantees depend on
  // unique indexes, and MongoDB transactions can't create them on the fly.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
