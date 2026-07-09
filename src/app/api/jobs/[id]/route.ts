import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({
    id,
    status: "queued",
    message: "Job persistence is represented in the UI prototype and worker scaffold; connect MongoDB to return live job state.",
  });
}