import { AppError } from '../utils/errors.js';

function check(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details);
  }
  return result.data;
}

// Checks req.body against a Zod schema before the route runs. Bad input is
// rejected with a 400 listing every problem; good input replaces req.body
// with the cleaned-up version (trimmed strings, unknown fields removed).
export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = check(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Same check for query strings (?q=...). Express 5 makes req.query
// read-only, so routes call this and use the returned object.
export function parseQuery(schema, query) {
  return check(schema, query);
}
