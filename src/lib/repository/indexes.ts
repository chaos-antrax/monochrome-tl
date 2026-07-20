import type { Collection } from "mongodb";
import { getDatabase } from "../db";
import type { StoredChapter, StoredGlossaryTerm, StoredJob, StoredNovel, StoredStyleGuide, StoredTranslationVersion, UserDocument } from "./types";

let indexSetupPromise: Promise<void> | null = null;

async function createIndexes() {
  const db = await getDatabase();
  await Promise.all([
    db.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<StoredNovel>("novels").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredNovel>("novels").createIndex({ userId: 1, published: 1 }),
    db.collection<StoredChapter>("chapters").createIndex({ userId: 1, novelId: 1, order: 1 }),
    db.collection<StoredChapter>("chapters").createIndex({ userId: 1, novelId: 1, published: 1, order: 1 }),
    db.collection<StoredChapter>("chapters").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredGlossaryTerm>("glossaryTerms").createIndex({ userId: 1, novelId: 1, sourceTerm: 1 }, { unique: true }),
    db.collection<StoredGlossaryTerm>("glossaryTerms").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredStyleGuide>("styleGuides").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredTranslationVersion>("translationVersions").createIndex({ userId: 1, chapterId: 1, version: 1 }, { unique: true }),
    db.collection<StoredJob>("jobs").createIndex({ userId: 1, status: 1 }),
    db.collection<StoredJob>("jobs").createIndex({ userId: 1, id: 1 }, { unique: true }),
  ]);
}

export function ensureIndexes() {
  indexSetupPromise ??= createIndexes().catch((error) => {
    indexSetupPromise = null;
    throw error;
  });
  return indexSetupPromise;
}

export async function collection<T extends object>(name: string): Promise<Collection<T>> {
  await ensureIndexes();
  return (await getDatabase()).collection<T>(name);
}
