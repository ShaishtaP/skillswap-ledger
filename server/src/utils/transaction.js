import mongoose from 'mongoose';

/**
 * Runs `fn(session)` inside a MongoDB transaction and returns its result.
 * Every database call inside must pass `{ session }`. If anything throws,
 * all changes are rolled back. If MongoDB reports a conflict with another
 * transaction, `fn` is run again from the start.
 */
export async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// Works whether a reference field holds an id or a populated document.
export const idOf = (value) => String(value?._id ?? value);
