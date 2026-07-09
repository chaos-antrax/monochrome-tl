import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getAppState, saveAppState } from "@/lib/repository";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ appState: await getAppState(session.userId) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load app state.");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    await saveAppState(session.userId, body.appState);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save app state.");
  }
}