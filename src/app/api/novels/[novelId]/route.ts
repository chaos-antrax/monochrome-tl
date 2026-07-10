import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getFullNovel } from "@/lib/repository";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ novelId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { novelId } = await context.params;
    const novel = await getFullNovel(session.userId, novelId);
    if (!novel) return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    return NextResponse.json({ novel });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load novel.");
  }
}