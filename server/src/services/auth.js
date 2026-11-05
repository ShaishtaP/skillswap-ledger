import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError, isDuplicateKeyError } from '../utils/errors.js';
import { runInTransaction } from '../utils/transaction.js';
import { MINT, postTransaction, userAccount } from './ledger.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export async function signup({ name, email, password }, { now = new Date() } = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    // The user and their welcome credits are created together: either both
    // exist or neither does. No user is ever left without their grant.
    user = await runInTransaction(async (session) => {
      const [created] = await User.create([{ name, email, passwordHash }], { session });
      await postTransaction(
        {
          key: `signup:${created.id}`,
          type: 'SIGNUP_GRANT',
          memo: 'Welcome credits',
          at: now,
          legs: [
            { account: MINT, amount: -config.signupGrantMinutes },
            { account: userAccount(created.id), amount: config.signupGrantMinutes },
          ],
        },
        { session },
      );
      return created;
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    throw err;
  }
  return { user, token: signToken(user) };
}

export async function updateProfile(userId, changes) {
  const user = await User.findByIdAndUpdate(userId, { $set: changes }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Same message whether the email or the password is wrong, so attackers
  // can't use the login form to discover which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return { user, token: signToken(user) };
}
