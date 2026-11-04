import { AppError } from '../utils/errors.js';

// Checks req.body against a Zod schema before the route runs. Bad input is
// rejected with a 400 listing every problem; good input replaces req.body
// with the cleaned-up version (trimmed strings, unknown fields removed).
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details));
    }
    req.body = result.data;
    next();
  };
}
