import type { Chapter, GlossaryTerm, Job, Novel, StyleGuide, TranslationVersion } from "@/app/workspace/types";
import { normalizeUserRole } from "../roles";
import type { ReadMode, StoredChapter, StoredGlossaryTerm, StoredJob, StoredNovel, StoredStyleGuide, StoredTranslationVersion, UserDocument } from "./types";

export function safeUser(user: UserDocument, fallbackId: string) {
  return {
    id: user._id?.toHexString() ?? fallbackId,
    email: user.email,
    role: normalizeUserRole(user.role),
    provider: user.provider,
    selectedModel: user.selectedModel,
    hasApiKey: Boolean(user.encryptedApiKey),
  };
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function splitNovel(novel: Novel, userId: string): StoredNovel {
  return stripUndefined({
    id: novel.id,
    userId,
    title: novel.title,
    description: novel.description,
    descriptionTranslated: novel.descriptionTranslated,
    styleGuideId: novel.styleGuideId,
    published: novel.published,
    publishedAt: novel.publishedAt,
    updatedAt: new Date(),
  });
}

export function splitChapter(novelId: string, chapter: Chapter, userId: string): StoredChapter {
  return stripUndefined({
    id: chapter.id,
    userId,
    novelId,
    title: chapter.title,
    order: chapter.order,
    rawText: chapter.rawText,
    rawTextHash: chapter.rawTextHash,
    status: chapter.status,
    currentVersion: chapter.currentVersion,
    published: chapter.published,
    publishedVersion: chapter.publishedVersion,
    publishedAt: chapter.publishedAt,
    error: chapter.error,
    updatedAt: new Date(),
  });
}

export function splitTerm(novelId: string, term: GlossaryTerm, userId: string): StoredGlossaryTerm {
  return stripUndefined({ ...term, userId, novelId, updatedAt: new Date() });
}

export function splitStyle(style: StyleGuide, userId: string): StoredStyleGuide {
  return { ...style, userId, updatedAtDate: new Date() };
}

export function splitJob(job: Job, userId: string): StoredJob {
  return stripUndefined({ ...job, userId, updatedAt: new Date() });
}

export function splitVersion(novelId: string, chapterId: string, version: TranslationVersion, userId: string): StoredTranslationVersion {
  return {
    version: version.version,
    text: version.text,
    model: version.model,
    provider: version.provider,
    tokensUsed: version.tokensUsed,
    estimatedCost: version.estimatedCost,
    createdAt: version.createdAt,
    rawTextHash: version.rawTextHash,
    userId,
    novelId,
    chapterId,
    updatedAt: new Date(),
  };
}

export function toChapter(chapter: StoredChapter, versions: TranslationVersion[], mode: ReadMode): Chapter {
  return {
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
    rawText: mode === "full" ? chapter.rawText : "",
    rawTextHash: chapter.rawTextHash,
    status: chapter.status,
    translations: versions.sort((a, b) => a.version - b.version),
    currentVersion: chapter.currentVersion,
    published: chapter.published,
    publishedVersion: chapter.publishedVersion,
    publishedAt: chapter.publishedAt,
    error: chapter.error,
  };
}

export function toNovel(novel: StoredNovel, chapters: Chapter[], glossary: GlossaryTerm[]): Novel {
  return {
    id: novel.id,
    title: novel.title,
    description: novel.description,
    descriptionTranslated: novel.descriptionTranslated,
    styleGuideId: novel.styleGuideId,
    published: novel.published,
    publishedAt: novel.publishedAt,
    glossary,
    chapters: chapters.sort((a, b) => a.order - b.order),
  };
}

export function toVersion(version: StoredTranslationVersion, mode: ReadMode): TranslationVersion {
  return {
    version: version.version,
    text: mode === "full" ? version.text : "",
    hasText: mode === "summary" ? true : Boolean(version.text?.trim()),
    model: version.model,
    provider: version.provider,
    tokensUsed: version.tokensUsed,
    estimatedCost: version.estimatedCost,
    createdAt: version.createdAt,
    rawTextHash: version.rawTextHash,
  };
}

export function toTerm(term: StoredGlossaryTerm): GlossaryTerm {
  return {
    id: term.id,
    sourceTerm: term.sourceTerm,
    translation: term.translation,
    category: term.category,
    pinyin: term.pinyin,
    notes: term.notes,
    status: term.status,
    discoveredInChapterId: term.discoveredInChapterId,
    conflict: term.conflict,
  };
}

export function toStyle(style: StoredStyleGuide): StyleGuide {
  return { id: style.id, name: style.name, content: style.content, createdAt: style.createdAt, updatedAt: style.updatedAt };
}

export function toJob(job: StoredJob): Job {
  return {
    id: job.id,
    novelId: job.novelId,
    chapterId: job.chapterId,
    target: job.target,
    status: job.status,
    provider: job.provider,
    model: job.model,
    attempts: job.attempts,
    tokensUsed: job.tokensUsed,
    estimatedCost: job.estimatedCost,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}



