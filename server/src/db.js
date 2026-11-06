import mongoose from 'mongoose';
import './models/index.js';

// Build collections and indexes up front. Our safety guarantees depend on
// unique indexes, and MongoDB transactions can't create them on the fly.
export async function initModels() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function connectDb(uri, options = {}) {
  await mongoose.connect(uri, options);
  await initModels();
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
