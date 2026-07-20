import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason");
  const redirectUrl = new URL("/login", url.origin);
  if (reason === "access-revoked") redirectUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(redirectUrl);
}
