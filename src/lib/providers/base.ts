import { TranslationRequest, TranslationResponse } from "../schemas/translation";

export type ProviderCallOptions = {
  apiKey: string;
  model: string;
  request: TranslationRequest;
};

export type ProviderClient = (options: ProviderCallOptions) => Promise<TranslationResponse>;

export function stripJsonFence(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}