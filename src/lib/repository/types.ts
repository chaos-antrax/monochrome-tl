import { ObjectId } from "mongodb";
import type { Provider } from "../schemas/translation";
import type { Chapter, GlossaryTerm, Job, Novel, StyleGuide, TranslationVersion } from "@/app/workspace/types";

export type UserDocument = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  provider?: Provider;
  encryptedApiKey?: { iv: string; authTag: string; ciphertext: string };
  selectedModel?: string;
  appState?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredNovel = Omit<Novel, "chapters" | "glossary"> & { userId: string; createdAt?: Date; updatedAt: Date };
export type StoredChapter = Omit<Chapter, "translations"> & { userId: string; novelId: string; updatedAt: Date };
export type StoredTranslationVersion = TranslationVersion & { userId: string; novelId: string; chapterId: string; updatedAt: Date };
export type StoredGlossaryTerm = GlossaryTerm & { userId: string; novelId: string; updatedAt: Date };
export type StoredStyleGuide = StyleGuide & { userId: string; updatedAtDate: Date };
export type StoredJob = Job & { userId: string; updatedAt: Date };

export type WorkspaceState = { novels?: Novel[]; styles?: StyleGuide[]; jobs?: Job[] };
export type ReadMode = "summary" | "full";

export type WorkspaceMutation =
  | { type: "novel:upsert"; novel: Novel }
  | { type: "novel:delete"; novelId: string }
  | { type: "chapter:upsert"; novelId: string; chapter: Chapter }
  | { type: "chapter:delete"; novelId: string; chapterId: string; orderUpdates?: Array<{ id: string; order: number }> }
  | { type: "chapters:reorder"; novelId: string; chapters: Array<{ id: string; order: number }> }
  | { type: "term:upsert"; novelId: string; term: GlossaryTerm }
  | { type: "term:delete"; novelId: string; termId: string }
  | { type: "style:upsert"; style: StyleGuide }
  | { type: "style:delete"; styleId: string }
  | { type: "job:upsert"; job: Job };
