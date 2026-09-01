import { TranslationRequestSchema, TranslationResponseSchema, type Provider } from "../schemas/translation";
import { callDeepSeek } from "./deepseek";
import { callOpenRouter } from "./openrouter";
import { callZai } from "./zai";

export async function translateWithProvider(options: {
  provider: Provider;
  apiKey: string;
  model: string;
  request: unknown;
}) {
  const request = TranslationRequestSchema.parse(options.request);
  const client = options.provider === "deepseek" ? callDeepSeek : options.provider === "openrouter" ? callOpenRouter : callZai;
  const response = await client({ apiKey: options.apiKey, model: options.model, request });
  return TranslationResponseSchema.parse(response);
}
