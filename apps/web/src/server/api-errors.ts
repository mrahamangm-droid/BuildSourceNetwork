import { NextResponse } from "next/server";
import { AppError } from "./errors";

const STATUS: Record<string, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
};

/** JSON error response for route handlers: service errors keep their message, others are generic. */
export function errorResponse(e: unknown) {
  if (e instanceof AppError)
    return NextResponse.json(
      { error: e.message, fieldErrors: e.fieldErrors },
      { status: STATUS[e.code] ?? 400 },
    );
  console.error("[api]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
