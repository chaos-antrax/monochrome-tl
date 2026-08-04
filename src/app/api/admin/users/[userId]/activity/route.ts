import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { assertObjectId, requireAdminUser } from "@/lib/auth";
import { getAdminUserActivity } from "@/lib/repository";

export async function GET(
  request: Request,
  context: RouteContext<"/api/admin/users/[userId]/activity">,
) {
  try {
    await requireAdminUser();
    const { userId } = await context.params;
    assertObjectId(userId);
    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const activity = await getAdminUserActivity(
      userId,
      Number.isFinite(limit) ? limit : 50,
    );
    if (!activity)
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(activity);
  } catch (error) {
    return apiErrorResponse(error, "Failed to load user activity.");
  }
}
