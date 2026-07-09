import { z } from "zod";
import { MAX_STYLE_GUIDE_CHARACTERS } from "../constants";

export const GlossaryCategorySchema = z.enum([
  "character",
  "place",
  "organization",
  "skill",
  "item",
  "honorific",
  "other",
]);

export const ProviderSchema = z.enum(["deepseek", "openrouter"]);

export const TranslationRequestSchema = z.object({
  systemPrompt: z.string().min(1),
  styleGuide: z.string().max(MAX_STYLE_GUIDE_CHARACTERS).nullable(),
  glossary: z.array(
    z.object({
      sourceTerm: z.string().min(1),
      translation: z.string().min(1),
      category: GlossaryCategorySchema,
    }),
  ),
  rawChapterText: z.string().min(1),
});

const NewTermSchema = z.object({
  sourceTerm: z.string().trim().min(1),
  translation: z.string().trim().min(1),
  category: GlossaryCategorySchema.catch("other"),
  notes: z.string().trim().optional(),
});

export const TranslationResponseSchema = z.object({
  title: z.string().trim().min(1).optional(),
  translatedText: z.string().trim().min(1),
  newTerms: z.preprocess((value) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { sourceTerm?: unknown; translation?: unknown };
      return typeof candidate.sourceTerm === "string" && candidate.sourceTerm.trim() && typeof candidate.translation === "string" && candidate.translation.trim();
    });
  }, z.array(NewTermSchema)).default([]),
});

export const ProviderConfigSchema = z.object({
  provider: ProviderSchema,
  apiKey: z.string().min(12),
  model: z.string().min(1),
});

export type GlossaryCategory = z.infer<typeof GlossaryCategorySchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;
export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;