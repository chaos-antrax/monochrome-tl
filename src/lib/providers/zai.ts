import OpenAI from "openai";
import { PROVIDER_DEFAULTS } from "../constants";
import { TranslationResponseSchema } from "../schemas/translation";
import { ProviderClient, stripJsonFence } from "./base";

export const callZai: ProviderClient = async ({ apiKey, model, request }) => {
  const client = new OpenAI({ apiKey, baseURL: PROVIDER_DEFAULTS.zai.baseUrl });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: JSON.stringify(request) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Z.ai returned an empty response.");
  return TranslationResponseSchema.parse(JSON.parse(stripJsonFence(content)));
};
