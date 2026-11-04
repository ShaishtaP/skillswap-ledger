import { verifyToken } from '../services/auth.js';
import { AppError } from '../utils/errors.js';

// Runs before protected routes. Reads "Authorization: Bearer <token>",
// checks the signature, and puts { id, role } on req.user.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in'));
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Your session has expired, please log in again'));
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role) return next(new AppError(403, 'FORBIDDEN', 'You are not allowed to do this'));
    next();
  };
}
