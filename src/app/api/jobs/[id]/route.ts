import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requirePortalUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePortalUser();
    const { id } = await context.params;
    return NextResponse.json({
      id,
      status: "queued",
      message: "Job persistence is represented in the UI prototype and worker scaffold; connect MongoDB to return live job state.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load job status.");
  }
}
