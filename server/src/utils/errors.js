// An error we throw on purpose. The error middleware turns it into a clean
// JSON response with the right HTTP status instead of a generic 500.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// MongoDB reports a unique-index violation as error code 11000.
export function isDuplicateKeyError(err) {
  return err?.code === 11000 || Boolean(err?.writeErrors?.some((e) => e.code === 11000));
}
