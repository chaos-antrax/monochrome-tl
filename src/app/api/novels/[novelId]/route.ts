import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getFullNovel } from "@/lib/repository";
import { requirePortalUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ novelId: string }> }) {
  try {
    const { session } = await requirePortalUser();
    const { novelId } = await context.params;
    const novel = await getFullNovel(session.userId, novelId);
    if (!novel) return NextResponse.json({ error: "Novel not found" }, { status: 404 });
    return NextResponse.json({ novel });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load novel.");
  }
}

