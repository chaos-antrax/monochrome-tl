export type ChapterStatus = "untranslated" | "queued" | "translating" | "translated" | "failed";
export type GlossaryStatus = "approved" | "pending" | "rejected";
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type ReaderMode = "raw" | "translated" | "diff";
export type Tokens = { input: number; output: number };

import type { GlossaryCategory, Provider } from "@/lib/schemas/translation";

export type TranslationVersion = {
  version: number;
  text: string;
  model: string;
  provider: Provider;
  tokensUsed: Tokens;
  estimatedCost: number;
  createdAt: string;
  rawTextHash: string;
};

export type Chapter = {
  id: string;
  title: string;
  order: number;
  rawText: string;
  rawTextHash: string;
  status: ChapterStatus;
  translations: TranslationVersion[];
  currentVersion: number;
  error?: string;
};

export type GlossaryTerm = {
  id: string;
  sourceTerm: string;
  translation: string;
  category: GlossaryCategory;
  pinyin?: string;
  notes?: string;
  status: GlossaryStatus;
  discoveredInChapterId?: string;
  conflict?: string;
};

export type StyleGuide = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type Novel = {
  id: string;
  title: string;
  description: string;
  descriptionTranslated?: string;
  styleGuideId?: string;
  glossary: GlossaryTerm[];
  chapters: Chapter[];
};

export type Job = {
  id: string;
  novelId: string;
  chapterId?: string;
  target: "chapter" | "description";
  status: JobStatus;
  provider: Provider;
  model: string;
  attempts: number;
  tokensUsed?: Tokens;
  estimatedCost?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

export type TranslationProgress = {
  id: string;
  novelId: string;
  chapterId?: string;
  target: "chapter" | "description";
  percent: number;
  label: string;
};

export type Account = {
  email: string;
  sessionExpiresAt: string;
  provider: Provider;
  selectedModel: string;
  apiKeyMasked?: string;
  verified: boolean;
};

export type ExportFormat = "txt" | "html" | "epub";
export type NewTerm = { sourceTerm: string; translation: string; category: GlossaryCategory; notes?: string };


