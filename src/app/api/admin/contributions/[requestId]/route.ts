import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireAdminUser } from "@/lib/auth";
import { decideContributionRequest, getAdminContributionRequest } from "@/lib/contributions/repository";

const PatchSchema = z.object({ action: z.enum(["accept", "reject"]) });

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { user } = await requireAdminUser();
    const { requestId } = await context.params;
    const item = await getAdminContributionRequest(requestId, user.id);
    if (!item) return NextResponse.json({ error: "Contribution request not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load contribution request.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAdminUser();
    const { requestId } = await context.params;
    const { action } = PatchSchema.parse(await request.json());
    const item = await decideContributionRequest(requestId, user.id, action);
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update contribution request.");
  }
}