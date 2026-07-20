import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { assertObjectId, requireAdminUser } from "@/lib/auth";
import { listUsersForAdmin, setUserWriterRole } from "@/lib/repository";

const PatchSchema = z.object({
  userId: z.string().min(1),
  writer: z.boolean(),
});

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ users: await listUsersForAdmin() });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load users.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser();
    const { userId, writer } = PatchSchema.parse(await request.json());
    assertObjectId(userId);
    const updated = await setUserWriterRole(userId, writer);
    if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update user role.");
  }
}
