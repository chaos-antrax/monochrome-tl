import OpenAI from "openai";
import { PROVIDER_DEFAULTS } from "../constants";
import { TranslationResponseSchema } from "../schemas/translation";
import { ProviderClient, stripJsonFence } from "./base";

export const callOpenRouter: ProviderClient = async ({ apiKey, model, request }) => {
  const client = new OpenAI({
    apiKey,
    baseURL: PROVIDER_DEFAULTS.openrouter.baseUrl,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Monochrome Translations",
    },
  });

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: JSON.stringify(request) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");
  return TranslationResponseSchema.parse(JSON.parse(stripJsonFence(content)));
};