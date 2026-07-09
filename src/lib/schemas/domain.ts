import { z } from "zod";
import { DEFAULT_MAX_CHAPTER_CHARACTERS, MAX_STYLE_GUIDE_CHARACTERS } from "../constants";
import { GlossaryCategorySchema } from "./translation";

export const ChapterStatusSchema = z.enum(["untranslated", "queued", "translating", "translated", "failed"]);
export const GlossaryStatusSchema = z.enum(["approved", "pending", "rejected"]);
export const JobStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);

export const NovelInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(DEFAULT_MAX_CHAPTER_CHARACTERS).optional().default(""),
  styleGuideId: z.string().optional(),
});

export const ChapterInputSchema = z.object({
  title: z.string().trim().max(160).optional().default(""),
  rawText: z.string().trim().min(1).max(DEFAULT_MAX_CHAPTER_CHARACTERS),
});

export const StyleGuideInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(MAX_STYLE_GUIDE_CHARACTERS),
});

export const GlossaryTermInputSchema = z.object({
  sourceTerm: z.string().trim().min(1).max(80),
  translation: z.string().trim().min(1).max(120),
  category: GlossaryCategorySchema,
  pinyin: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export type ChapterStatus = z.infer<typeof ChapterStatusSchema>;
export type GlossaryStatus = z.infer<typeof GlossaryStatusSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;