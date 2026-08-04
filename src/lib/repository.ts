import { ObjectId } from "mongodb";
import { decryptSecret, encryptSecret } from "./crypto";
import { normalizeUserRole, type UserRole } from "./roles";
import type { Provider } from "./schemas/translation";
import type { Chapter, GlossaryTerm, TranslationVersion } from "@/app/workspace/types";
import { collection } from "./repository/indexes";
import { safeUser, splitChapter, splitJob, splitNovel, splitStyle, splitTerm, splitVersion, toChapter, toJob, toNovel, toStyle, toTerm, toVersion } from "./repository/mappers";
import type { ReadMode, StoredChapter, StoredGlossaryTerm, StoredJob, StoredNovel, StoredStyleGuide, StoredTranslationVersion, UserDocument, WorkspaceMutation, WorkspaceState } from "./repository/types";

export type { WorkspaceMutation } from "./repository/types";
export { ensureIndexes } from "./repository/indexes";

export async function usersCollection() {
  return collection<UserDocument>("users");
}

export async function findUserByEmail(email: string) {
  return (await usersCollection()).findOne({ email: email.toLowerCase() });
}


export async function getSafeUser(userId: string) {
  const user = await (await usersCollection()).findOne({ _id: new ObjectId(userId) });
  if (!user) return null;
  return safeUser(user, userId);
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
  const [novels, chapters, styles, versions, jobs] = await Promise.all([
    (await collection<StoredNovel>("novels")).find({ userId }).sort({ updatedAt: -1 }).toArray(),
    (await collection<StoredChapter>("chapters")).find({ userId }, mode === "summary" ? { projection: { rawText: 0 } } : undefined).sort({ order: 1 }).toArray(),
    (await collection<StoredStyleGuide>("styleGuides")).find({ userId }).sort({ updatedAt: -1 }).toArray(),
    (await collection<StoredTranslationVersion>("translationVersions")).find({ userId }, mode === "summary" ? { projection: { text: 0 } } : undefined).sort({ version: 1 }).toArray(),
    (await collection<StoredJob>("jobs")).find({ userId }).sort({ createdAt: -1 }).toArray(),
  ]);

  const termsCollection = await collection<StoredGlossaryTerm>("glossaryTerms");
  const terms = mode === "full" ? await termsCollection.find({ userId }).toArray() : [];
  const summaryTermCounts = mode === "summary"
    ? await termsCollection.aggregate<{ _id: string; total: number; pending: number }>([
        { $match: { userId } },
        {
          $group: {
            _id: "$novelId",
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          },
        },
      ]).toArray()
    : [];

  const termCountsByNovel = new Map(summaryTermCounts.map((entry) => [entry._id, { total: entry.total, pending: entry.pending }]));

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
    novels: novels.map((novel) => {
      const glossary = termsByNovel.get(novel.id) ?? [];
      const counts = termCountsByNovel.get(novel.id);
      return toNovel(novel, chaptersByNovel.get(novel.id) ?? [], glossary, {
        isFull: mode === "full",
        glossaryCount: counts?.total ?? glossary.length,
        pendingGlossaryCount: counts?.pending ?? glossary.filter((term) => term.status === "pending").length,
      });
    }),
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
    { projection: { email: 1, role: 1, provider: 1, selectedModel: 1, encryptedApiKey: 1, appState: 1 } },
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
    { isFull: true },
  );
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
      const novelUpdate = mutation.novel.published ? { $set: splitNovel(mutation.novel, userId), $setOnInsert: { createdAt: now } } : { $set: splitNovel(mutation.novel, userId), $unset: { publishedAt: "" as const }, $setOnInsert: { createdAt: now } };
      await novelsCollection.updateOne({ userId, id: mutation.novel.id }, novelUpdate, { upsert: true });
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
      const chapterDocument = splitChapter(mutation.novelId, mutation.chapter, userId);
      if (!mutation.chapter.rawText.trim()) delete (chapterDocument as Partial<StoredChapter>).rawText;
      const chapterUpdate = mutation.chapter.published ? { $set: chapterDocument } : { $set: chapterDocument, $unset: { publishedVersion: "" as const, publishedAt: "" as const } };
      await chaptersCollection.updateOne({ userId, id: mutation.chapter.id }, chapterUpdate, { upsert: true });
      for (const version of mutation.chapter.translations) {
        if (!version.text.trim()) continue;
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


export async function listUsersForAdmin() {
  const users = await (await usersCollection()).find(
    {},
    { projection: { email: 1, username: 1, role: 1, createdAt: 1, updatedAt: 1 }, sort: { createdAt: -1 } },
  ).toArray();
  return users.map((user) => ({
    id: user._id?.toHexString() ?? "",
    email: user.email,
    username: typeof user.username === "string" ? user.username : undefined,
    role: normalizeUserRole(user.role),
    createdAt: user.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: user.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  }));
}

export async function setUserWriterRole(userId: string, enabled: boolean) {
  const users = await usersCollection();
  const _id = new ObjectId(userId);
  const existing = await users.findOne({ _id }, { projection: { role: 1 } });
  if (!existing) return null;
  const currentRole = normalizeUserRole(existing.role);
  if (currentRole === "admin") return { id: userId, role: "admin" as UserRole };
  const role: UserRole = enabled ? "writer" : "reader";
  await users.updateOne({ _id }, { $set: { role, updatedAt: new Date() } });
  return { id: userId, role };
}


type ReaderDiscussionDocument = {
  id: string;
  userId: string;
  novelId: string;
  chapterId?: string;
  parentId?: string;
  topLevel?: boolean;
  body: string;
  rating?: number;
  createdAt: Date;
  updatedAt?: Date;
};

export type AdminUserActivityItem = {
  id: string;
  kind: "review" | "review-reply" | "comment" | "comment-reply";
  body: string;
  rating?: number;
  novelId: string;
  novelTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  createdAt: string;
  updatedAt?: string;
};

export type AdminUserActivity = {
  user: {
    id: string;
    email: string;
    username?: string;
    role: UserRole;
  };
  summary: {
    reviews: number;
    reviewReplies: number;
    comments: number;
    commentReplies: number;
    total: number;
    latestActivityAt?: string;
  };
  items: AdminUserActivityItem[];
};

async function countReaderDiscussions(collectionName: "readerReviews" | "readerComments", userId: string) {
  const discussionCollection = await collection<ReaderDiscussionDocument>(collectionName);
  const [topLevel, replies] = await Promise.all([
    discussionCollection.countDocuments({ userId, topLevel: true }),
    discussionCollection.countDocuments({ userId, topLevel: false }),
  ]);
  return { topLevel, replies };
}

export async function getAdminUserActivity(userId: string, limit = 50): Promise<AdminUserActivity | null> {
  const users = await usersCollection();
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { email: 1, username: 1, role: 1 } },
  );
  if (!user) return null;

  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const projection = { _id: 0, id: 1, userId: 1, novelId: 1, chapterId: 1, parentId: 1, topLevel: 1, body: 1, rating: 1, createdAt: 1, updatedAt: 1 };
  const [reviews, comments, reviewCounts, commentCounts] = await Promise.all([
    (await collection<ReaderDiscussionDocument>("readerReviews")).find({ userId }, { projection }).sort({ createdAt: -1 }).limit(boundedLimit).toArray(),
    (await collection<ReaderDiscussionDocument>("readerComments")).find({ userId }, { projection }).sort({ createdAt: -1 }).limit(boundedLimit).toArray(),
    countReaderDiscussions("readerReviews", userId),
    countReaderDiscussions("readerComments", userId),
  ]);

  const latestItems = [...reviews, ...comments]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, boundedLimit);

  const novelIds = [...new Set(latestItems.map((item) => item.novelId).filter(Boolean))];
  const chapterIds = [...new Set(latestItems.map((item) => item.chapterId).filter((value): value is string => Boolean(value)))];
  const [novels, chapters] = await Promise.all([
    novelIds.length
      ? (await collection<{ id: string; title: string }>("novels")).find({ id: { $in: novelIds } }, { projection: { _id: 0, id: 1, title: 1 } }).toArray()
      : Promise.resolve([]),
    chapterIds.length
      ? (await collection<{ id: string; title: string }>("chapters")).find({ id: { $in: chapterIds } }, { projection: { _id: 0, id: 1, title: 1 } }).toArray()
      : Promise.resolve([]),
  ]);

  const novelTitles = new Map(novels.map((novel) => [novel.id, novel.title]));
  const chapterTitles = new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
  const reviewIds = new Set(reviews.map((review) => review.id));

  const items = latestItems.map((item): AdminUserActivityItem => {
    const isReview = reviewIds.has(item.id);
    const isReply = item.topLevel === false || Boolean(item.parentId);
    return {
      id: item.id,
      kind: isReview ? (isReply ? "review-reply" : "review") : (isReply ? "comment-reply" : "comment"),
      body: item.body,
      ...(typeof item.rating === "number" ? { rating: item.rating } : {}),
      novelId: item.novelId,
      novelTitle: novelTitles.get(item.novelId) ?? "Unavailable novel",
      ...(item.chapterId ? { chapterId: item.chapterId, chapterTitle: chapterTitles.get(item.chapterId) ?? "Unavailable chapter" } : {}),
      createdAt: item.createdAt.toISOString(),
      ...(item.updatedAt ? { updatedAt: item.updatedAt.toISOString() } : {}),
    };
  });

  const latestActivityAt = items[0]?.createdAt;

  return {
    user: {
      id: userId,
      email: user.email,
      username: typeof user.username === "string" ? user.username : undefined,
      role: normalizeUserRole(user.role),
    },
    summary: {
      reviews: reviewCounts.topLevel,
      reviewReplies: reviewCounts.replies,
      comments: commentCounts.topLevel,
      commentReplies: commentCounts.replies,
      total: reviewCounts.topLevel + reviewCounts.replies + commentCounts.topLevel + commentCounts.replies,
      ...(latestActivityAt ? { latestActivityAt } : {}),
    },
    items,
  };
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





