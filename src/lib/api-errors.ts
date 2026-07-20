import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { DatabaseUnavailableError } from "./db";

export function apiErrorResponse(error: unknown, fallback = "Request failed.") {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof DatabaseUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues.map((issue) => issue.message).join("; ") }, { status: 400 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 400 });
}
