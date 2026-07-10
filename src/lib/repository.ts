import { ObjectId, type Collection } from "mongodb";
import { getDatabase } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import type { Provider } from "./schemas/translation";
import type { Chapter, GlossaryTerm, Job, Novel, StyleGuide, TranslationVersion } from "@/app/workspace/types";

type UserDocument = {
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

type StoredNovel = Omit<Novel, "chapters" | "glossary"> & { userId: string; createdAt?: Date; updatedAt: Date };
type StoredChapter = Omit<Chapter, "translations"> & { userId: string; novelId: string; updatedAt: Date };
type StoredTranslationVersion = TranslationVersion & { userId: string; novelId: string; chapterId: string; updatedAt: Date };
type StoredGlossaryTerm = GlossaryTerm & { userId: string; novelId: string; updatedAt: Date };
type StoredStyleGuide = StyleGuide & { userId: string; updatedAtDate: Date };
type StoredJob = Job & { userId: string; updatedAt: Date };

type WorkspaceState = { novels?: Novel[]; styles?: StyleGuide[]; jobs?: Job[] };
type ReadMode = "summary" | "full";

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

export async function ensureIndexes() {
  const db = await getDatabase();
  await Promise.all([
    db.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<StoredNovel>("novels").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredChapter>("chapters").createIndex({ userId: 1, novelId: 1, order: 1 }),
    db.collection<StoredChapter>("chapters").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredGlossaryTerm>("glossaryTerms").createIndex({ userId: 1, novelId: 1, sourceTerm: 1 }, { unique: true }),
    db.collection<StoredGlossaryTerm>("glossaryTerms").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredStyleGuide>("styleGuides").createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection<StoredTranslationVersion>("translationVersions").createIndex({ userId: 1, chapterId: 1, version: 1 }, { unique: true }),
    db.collection<StoredJob>("jobs").createIndex({ userId: 1, status: 1 }),
    db.collection<StoredJob>("jobs").createIndex({ userId: 1, id: 1 }, { unique: true }),
  ]);
}

async function collection<T extends object>(name: string): Promise<Collection<T>> {
  await ensureIndexes();
  return (await getDatabase()).collection<T>(name);
}

export async function usersCollection() {
  return collection<UserDocument>("users");
}

export async function findUserByEmail(email: string) {
  return (await usersCollection()).findOne({ email: email.toLowerCase() });
}

export async function createUser(email: string, passwordHash: string) {
  const users = await usersCollection();
  const now = new Date();
  const result = await users.insertOne({ email: email.toLowerCase(), passwordHash, createdAt: now, updatedAt: now });
  return { _id: result.insertedId, email: email.toLowerCase() };
}

export async function getSafeUser(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) });
  if (!user) return null;
  return safeUser(user, userId);
}

function safeUser(user: UserDocument, fallbackId: string) {
  return {
    id: user._id?.toHexString() ?? fallbackId,
    email: user.email,
    provider: user.provider,
    selectedModel: user.selectedModel,
    hasApiKey: Boolean(user.encryptedApiKey),
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function splitNovel(novel: Novel, userId: string): StoredNovel {
  return stripUndefined({
    id: novel.id,
    userId,
    title: novel.title,
    description: novel.description,
    descriptionTranslated: novel.descriptionTranslated,
    styleGuideId: novel.styleGuideId,
    updatedAt: new Date(),
  });
}

function splitChapter(novelId: string, chapter: Chapter, userId: string): StoredChapter {
  return stripUndefined({
    id: chapter.id,
    userId,
    novelId,
    title: chapter.title,
    volume: chapter.volume,
    order: chapter.order,
    rawText: chapter.rawText,
    rawTextHash: chapter.rawTextHash,
    status: chapter.status,
    currentVersion: chapter.currentVersion,
    error: chapter.error,
    updatedAt: new Date(),
  });
}

function splitTerm(novelId: string, term: GlossaryTerm, userId: string): StoredGlossaryTerm {
  return stripUndefined({ ...term, userId, novelId, updatedAt: new Date() });
}

function splitStyle(style: StyleGuide, userId: string): StoredStyleGuide {
  return { ...style, userId, updatedAtDate: new Date() };
}

function splitJob(job: Job, userId: string): StoredJob {
  return stripUndefined({ ...job, userId, updatedAt: new Date() });
}

function splitVersion(novelId: string, chapterId: string, version: TranslationVersion, userId: string): StoredTranslationVersion {
  return { ...version, userId, novelId, chapterId, updatedAt: new Date() };
}

function toChapter(chapter: StoredChapter, versions: TranslationVersion[], mode: ReadMode): Chapter {
  return {
    id: chapter.id,
    title: chapter.title,
    volume: chapter.volume,
    order: chapter.order,
    rawText: mode === "full" ? chapter.rawText : "",
    rawTextHash: chapter.rawTextHash,
    status: chapter.status,
    translations: versions.sort((a, b) => a.version - b.version),
    currentVersion: chapter.currentVersion,
    error: chapter.error,
  };
}

function toNovel(novel: StoredNovel, chapters: Chapter[], glossary: GlossaryTerm[]): Novel {
  return {
    id: novel.id,
    title: novel.title,
    description: novel.description,
    descriptionTranslated: novel.descriptionTranslated,
    styleGuideId: novel.styleGuideId,
    glossary,
    chapters: chapters.sort((a, b) => a.order - b.order),
  };
}

function toVersion(version: StoredTranslationVersion, mode: ReadMode): TranslationVersion {
  return {
    version: version.version,
    text: mode === "full" ? version.text : "",
    model: version.model,
    provider: version.provider,
    tokensUsed: version.tokensUsed,
    estimatedCost: version.estimatedCost,
    createdAt: version.createdAt,
    rawTextHash: version.rawTextHash,
  };
}

function toTerm(term: StoredGlossaryTerm): GlossaryTerm {
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

function toStyle(style: StoredStyleGuide): StyleGuide {
  return { id: style.id, name: style.name, content: style.content, createdAt: style.createdAt, updatedAt: style.updatedAt };
}

function toJob(job: StoredJob): Job {
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

async function hasStructuredWorkspace(userId: string) {
  const [novelCount, styleCount, jobCount] = await Promise.all([
    (await collection<StoredNovel>("novels")).countDocuments({ userId }, { limit: 1 }),
    (await collection<StoredStyleGuide>("styleGuides")).countDocuments({ userId }, { limit: 1 }),
    (await collection<StoredJob>("jobs")).countDocuments({ userId }, { limit: 1 }),
  ]);
  return novelCount + styleCount + jobCount > 0;
}

export async function getStructuredAppState(userId: string, mode: ReadMode = "full"): Promise<WorkspaceState> {
  const [novels, chapters, terms, styles, versions, jobs] = await Promise.all([
    (await collection<StoredNovel>("novels")).find({ userId }).sort({ updatedAt: -1 }).toArray(),
    (await collection<StoredChapter>("chapters")).find({ userId }, mode === "summary" ? { projection: { rawText: 0 } } : undefined).sort({ order: 1 }).toArray(),
    (await collection<StoredGlossaryTerm>("glossaryTerms")).find({ userId }).toArray(),
    (await collection<StoredStyleGuide>("styleGuides")).find({ userId }).sort({ updatedAt: -1 }).toArray(),
    (await collection<StoredTranslationVersion>("translationVersions")).find({ userId }, mode === "summary" ? { projection: { text: 0 } } : undefined).sort({ version: 1 }).toArray(),
    (await collection<StoredJob>("jobs")).find({ userId }).sort({ createdAt: -1 }).toArray(),
  ]);

  const versionsByChapter = new Map<string, TranslationVersion[]>();
  versions.forEach((version) => {
    const list = versionsByChapter.get(version.chapterId) ?? [];
    list.push(toVersion(version, mode));
    versionsByChapter.set(version.chapterId, list);
  });

  const chaptersByNovel = new Map<string, Chapter[]>();
  chapters.forEach((chapter) => {
    const list = chaptersByNovel.get(chapter.novelId) ?? [];
    list.push(toChapter(chapter, versionsByChapter.get(chapter.id) ?? [], mode));
    chaptersByNovel.set(chapter.novelId, list);
  });

  const termsByNovel = new Map<string, GlossaryTerm[]>();
  terms.forEach((term) => {
    const list = termsByNovel.get(term.novelId) ?? [];
    list.push(toTerm(term));
    termsByNovel.set(term.novelId, list);
  });

  return {
    novels: novels.map((novel) => toNovel(novel, chaptersByNovel.get(novel.id) ?? [], termsByNovel.get(novel.id) ?? [])),
    styles: styles.map(toStyle),
    jobs: jobs.map(toJob),
  };
}

export async function replaceCollectionAppState(userId: string, appState: WorkspaceState) {
  const [novelsCollection, chaptersCollection, termsCollection, stylesCollection, versionsCollection, jobsCollection] = await Promise.all([
    collection<StoredNovel>("novels"),
    collection<StoredChapter>("chapters"),
    collection<StoredGlossaryTerm>("glossaryTerms"),
    collection<StoredStyleGuide>("styleGuides"),
    collection<StoredTranslationVersion>("translationVersions"),
    collection<StoredJob>("jobs"),
  ]);

  await Promise.all([
    novelsCollection.deleteMany({ userId }),
    chaptersCollection.deleteMany({ userId }),
    termsCollection.deleteMany({ userId }),
    stylesCollection.deleteMany({ userId }),
    versionsCollection.deleteMany({ userId }),
    jobsCollection.deleteMany({ userId }),
  ]);

  const novels = appState.novels ?? [];
  const styles = appState.styles ?? [];
  const jobs = appState.jobs ?? [];
  const chapters = novels.flatMap((novel) => novel.chapters.map((chapter) => splitChapter(novel.id, chapter, userId)));
  const terms = novels.flatMap((novel) => novel.glossary.map((term) => splitTerm(novel.id, term, userId)));
  const versions = novels.flatMap((novel) => novel.chapters.flatMap((chapter) => chapter.translations.map((version) => splitVersion(novel.id, chapter.id, version, userId))));

  await Promise.all([
    novels.length ? novelsCollection.insertMany(novels.map((novel) => splitNovel(novel, userId))) : Promise.resolve(),
    chapters.length ? chaptersCollection.insertMany(chapters) : Promise.resolve(),
    terms.length ? termsCollection.insertMany(terms) : Promise.resolve(),
    styles.length ? stylesCollection.insertMany(styles.map((style) => splitStyle(style, userId))) : Promise.resolve(),
    versions.length ? versionsCollection.insertMany(versions) : Promise.resolve(),
    jobs.length ? jobsCollection.insertMany(jobs.map((job) => splitJob(job, userId))) : Promise.resolve(),
  ]);
}

export async function getBootstrapState(userId: string) {
  const user = await (await usersCollection()).findOne(
    { _id: new ObjectId(userId) },
    { projection: { email: 1, provider: 1, selectedModel: 1, encryptedApiKey: 1, appState: 1 } },
  );
  if (!user) return { user: null, appState: null };

  const structuredExists = await hasStructuredWorkspace(userId);
  if (!structuredExists && user.appState) {
    await replaceCollectionAppState(userId, user.appState as WorkspaceState);
    await (await usersCollection()).updateOne({ _id: new ObjectId(userId) }, { $unset: { appState: "" }, $set: { updatedAt: new Date() } });
    return { user: safeUser(user, userId), appState: await getStructuredAppState(userId, "summary") };
  }

  return { user: safeUser(user, userId), appState: await getStructuredAppState(userId, "summary") };
}

export async function getAppState(userId: string) {
  return getStructuredAppState(userId);
}


export async function getFullChapter(userId: string, novelId: string, chapterId: string) {
  const [chapter, versions] = await Promise.all([
    (await collection<StoredChapter>("chapters")).findOne({ userId, novelId, id: chapterId }),
    (await collection<StoredTranslationVersion>("translationVersions")).find({ userId, novelId, chapterId }).sort({ version: 1 }).toArray(),
  ]);
  if (!chapter) return null;
  return toChapter(chapter, versions.map((version) => toVersion(version, "full")), "full");
}

export async function getFullNovel(userId: string, novelId: string) {
  const [novel, chapters, terms, versions] = await Promise.all([
    (await collection<StoredNovel>("novels")).findOne({ userId, id: novelId }),
    (await collection<StoredChapter>("chapters")).find({ userId, novelId }).sort({ order: 1 }).toArray(),
    (await collection<StoredGlossaryTerm>("glossaryTerms")).find({ userId, novelId }).toArray(),
    (await collection<StoredTranslationVersion>("translationVersions")).find({ userId, novelId }).sort({ version: 1 }).toArray(),
  ]);
  if (!novel) return null;
  const versionsByChapter = new Map<string, TranslationVersion[]>();
  versions.forEach((version) => {
    const list = versionsByChapter.get(version.chapterId) ?? [];
    list.push(toVersion(version, "full"));
    versionsByChapter.set(version.chapterId, list);
  });
  return toNovel(
    novel,
    chapters.map((chapter) => toChapter(chapter, versionsByChapter.get(chapter.id) ?? [], "full")),
    terms.map(toTerm),
  );
}
export async function saveAppState(userId: string, appState: unknown) {
  await replaceCollectionAppState(userId, appState as WorkspaceState);
  await (await usersCollection()).updateOne({ _id: new ObjectId(userId) }, { $unset: { appState: "" }, $set: { updatedAt: new Date() } });
}

export async function applyWorkspaceMutations(userId: string, mutations: WorkspaceMutation[]) {
  const now = new Date();
  const [novelsCollection, chaptersCollection, termsCollection, stylesCollection, versionsCollection, jobsCollection] = await Promise.all([
    collection<StoredNovel>("novels"),
    collection<StoredChapter>("chapters"),
    collection<StoredGlossaryTerm>("glossaryTerms"),
    collection<StoredStyleGuide>("styleGuides"),
    collection<StoredTranslationVersion>("translationVersions"),
    collection<StoredJob>("jobs"),
  ]);

  for (const mutation of mutations) {
    if (mutation.type === "novel:upsert") {
      await novelsCollection.updateOne({ userId, id: mutation.novel.id }, { $set: splitNovel(mutation.novel, userId), $setOnInsert: { createdAt: now } }, { upsert: true });
    }
    if (mutation.type === "novel:delete") {
      await Promise.all([
        novelsCollection.deleteOne({ userId, id: mutation.novelId }),
        chaptersCollection.deleteMany({ userId, novelId: mutation.novelId }),
        termsCollection.deleteMany({ userId, novelId: mutation.novelId }),
        versionsCollection.deleteMany({ userId, novelId: mutation.novelId }),
        jobsCollection.deleteMany({ userId, novelId: mutation.novelId }),
      ]);
    }
    if (mutation.type === "chapter:upsert") {
      await chaptersCollection.updateOne({ userId, id: mutation.chapter.id }, { $set: splitChapter(mutation.novelId, mutation.chapter, userId) }, { upsert: true });
      for (const version of mutation.chapter.translations) {
        await versionsCollection.updateOne({ userId, chapterId: mutation.chapter.id, version: version.version }, { $set: splitVersion(mutation.novelId, mutation.chapter.id, version, userId) }, { upsert: true });
      }
    }
    if (mutation.type === "chapter:delete") {
      await Promise.all([
        chaptersCollection.deleteOne({ userId, id: mutation.chapterId }),
        versionsCollection.deleteMany({ userId, chapterId: mutation.chapterId }),
      ]);
      if (mutation.orderUpdates?.length) {
        await Promise.all(mutation.orderUpdates.map((entry) => chaptersCollection.updateOne({ userId, id: entry.id }, { $set: { order: entry.order, updatedAt: now } })));
      }
    }
    if (mutation.type === "chapters:reorder") {
      await Promise.all(mutation.chapters.map((entry) => chaptersCollection.updateOne({ userId, novelId: mutation.novelId, id: entry.id }, { $set: { order: entry.order, updatedAt: now } })));
    }
    if (mutation.type === "term:upsert") {
      await termsCollection.updateOne({ userId, id: mutation.term.id }, { $set: splitTerm(mutation.novelId, mutation.term, userId) }, { upsert: true });
    }
    if (mutation.type === "term:delete") {
      await termsCollection.deleteOne({ userId, id: mutation.termId, novelId: mutation.novelId });
    }
    if (mutation.type === "style:upsert") {
      await stylesCollection.updateOne({ userId, id: mutation.style.id }, { $set: splitStyle(mutation.style, userId) }, { upsert: true });
    }
    if (mutation.type === "style:delete") {
      await stylesCollection.deleteOne({ userId, id: mutation.styleId });
      await novelsCollection.updateMany({ userId, styleGuideId: mutation.styleId }, { $unset: { styleGuideId: "" }, $set: { updatedAt: now } });
    }
    if (mutation.type === "job:upsert") {
      await jobsCollection.updateOne({ userId, id: mutation.job.id }, { $set: splitJob(mutation.job, userId) }, { upsert: true });
    }
  }
}

export async function saveProviderConfig(userId: string, provider: Provider, apiKey: string, selectedModel: string) {
  await (await usersCollection()).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { provider, selectedModel, encryptedApiKey: encryptSecret(apiKey), updatedAt: new Date() } },
  );
}

export async function getProviderConfig(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) });
  if (!user?.provider || !user.selectedModel || !user.encryptedApiKey) return null;
  return {
    provider: user.provider,
    model: user.selectedModel,
    apiKey: decryptSecret(user.encryptedApiKey),
  };
}