import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireAdminUser } from "@/lib/auth";
import { createAdminContributionMessage, listAdminContributionMessages } from "@/lib/contributions/repository";

const MessageSchema = z.object({ body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message must be 2,000 characters or fewer.") });

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAdminUser();
    const { requestId } = await context.params;
    const afterParam = new URL(request.url).searchParams.get("after");
    const afterDate = afterParam ? new Date(afterParam) : undefined;
    const messages = await listAdminContributionMessages(requestId, user.id, afterDate && Number.isFinite(afterDate.getTime()) ? afterDate : undefined);
    return NextResponse.json({ messages });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load contribution messages.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAdminUser();
    const { requestId } = await context.params;
    const { body } = MessageSchema.parse(await request.json());
    const message = await createAdminContributionMessage(requestId, user.id, body);
    return NextResponse.json({ message });
  } catch (error) {
    return apiErrorResponse(error, "Failed to send contribution message.");
  }
}