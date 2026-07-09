import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { saveProviderConfig } from "@/lib/repository";
import { getSession } from "@/lib/session";
import { ProviderConfigSchema } from "@/lib/schemas/translation";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { provider, apiKey, model } = ProviderConfigSchema.parse(await request.json());
    await saveProviderConfig(session.userId, provider, apiKey, model);
    return NextResponse.json({ ok: true, provider, selectedModel: model, hasApiKey: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save provider settings.");
  }
}