import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getAppState, saveAppState } from "@/lib/repository";
import { requirePortalUser } from "@/lib/auth";

export async function GET() {
  try {
    const { session } = await requirePortalUser();
    return NextResponse.json({ appState: await getAppState(session.userId) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load app state.");
  }
}

export async function PUT(request: Request) {
  try {
    const { session } = await requirePortalUser();
    const body = await request.json();
    await saveAppState(session.userId, body.appState);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save app state.");
  }
}

