import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { applyWorkspaceMutations, type WorkspaceMutation } from "@/lib/repository";
import { requirePortalUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { session } = await requirePortalUser();
    const body = (await request.json()) as { mutations?: WorkspaceMutation[] };
    if (!Array.isArray(body.mutations)) return NextResponse.json({ error: "Expected mutations array." }, { status: 400 });
    await applyWorkspaceMutations(session.userId, body.mutations);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save workspace changes.");
  }
}

