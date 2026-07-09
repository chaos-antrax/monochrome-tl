import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { TRANSLATION_SYSTEM_PROMPT } from "@/lib/constants";
import { getProviderConfig } from "@/lib/repository";
import { getSession } from "@/lib/session";
import { TranslationRequestSchema } from "@/lib/schemas/translation";
import { translateWithProvider } from "@/lib/providers";

function sanitizeGlossary(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { sourceTerm?: unknown; translation?: unknown; category?: unknown };
    if (typeof entry.sourceTerm !== "string" || typeof entry.translation !== "string") return [];
    const sourceTerm = entry.sourceTerm.trim();
    const translation = entry.translation.trim();
    if (!sourceTerm || !translation) return [];
    const categories = ["character", "place", "organization", "skill", "item", "honorific", "other"];
    const category = typeof entry.category === "string" && categories.includes(entry.category) ? entry.category : "other";
    return [{ sourceTerm, translation, category }];
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in before calling a provider." }, { status: 401 });

    const config = await getProviderConfig(session.userId);
    if (!config) return NextResponse.json({ error: "Provider API key is not configured." }, { status: 400 });

    const body = await request.json();
    const payload = TranslationRequestSchema.parse({
      systemPrompt: TRANSLATION_SYSTEM_PROMPT,
      styleGuide: body.styleGuide ?? null,
      glossary: sanitizeGlossary(body.glossary),
      rawChapterText: body.description,
    });

    const response = await translateWithProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      request: payload,
    });

    return NextResponse.json({ response, provider: config.provider, model: config.model });
  } catch (error) {
    return apiErrorResponse(error, "Translation failed.");
  }
}