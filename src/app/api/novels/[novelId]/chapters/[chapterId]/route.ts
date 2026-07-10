import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getFullChapter } from "@/lib/repository";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ novelId: string; chapterId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { novelId, chapterId } = await context.params;
    const chapter = await getFullChapter(session.userId, novelId, chapterId);
    if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    return NextResponse.json({ chapter });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load chapter.");
  }
}