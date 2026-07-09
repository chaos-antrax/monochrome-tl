import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getSafeUser } from "@/lib/repository";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });
    const user = await getSafeUser(session.userId);
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load the current user.");
  }
}