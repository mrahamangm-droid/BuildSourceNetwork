export type ErrorCode =
  "VALIDATION" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT" | "UNAUTHENTICATED";

/** Thrown by services; actions convert it to a user-facing message. Never contains secrets. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = "VALIDATION",
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
