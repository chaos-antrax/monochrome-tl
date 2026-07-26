import type { Collection } from "mongodb";
import type { ContributionAuditEvent, ContributionMessage, ContributionRequest } from "@/lib/contributions/types";
import { getDatabase } from "../db";
import type { StoredChapter, StoredGlossaryTerm, StoredJob, StoredNovel, StoredStyleGuide, StoredTranslationVersion, UserDocument } from "./types";

let indexSetupPromise: Promise<void> | null = null;

async function createIndexes() {
  const db = await getDatabase();
  await Promise.all([
    db.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<UserDocument>("users").createIndex({ role: 1 }),
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
    db.collection<ContributionRequest>("readerContributionRequests").createIndex({ id: 1 }, { unique: true, name: "reader_contribution_request_id" }),
    db.collection<ContributionRequest>("readerContributionRequests").createIndex({ userId: 1, createdAt: -1 }, { name: "reader_contribution_requests_user" }),
    db.collection<ContributionRequest>("readerContributionRequests").createIndex({ status: 1, createdAt: 1 }, { name: "reader_contribution_requests_admin_inbox" }),
    db.collection<ContributionRequest>("readerContributionRequests").createIndex({ adminId: 1, status: 1, updatedAt: -1 }, { name: "reader_contribution_requests_assignee" }),
    db.collection<ContributionMessage>("readerContributionMessages").createIndex({ requestId: 1, createdAt: 1 }, { name: "reader_contribution_messages_thread" }),
    db.collection<ContributionAuditEvent>("readerContributionAudit").createIndex({ requestId: 1, createdAt: 1 }, { name: "reader_contribution_audit_request" }),
  ]);
}

export function ensureIndexes() {
  indexSetupPromise ??= createIndexes().catch((error) => {
    indexSetupPromise = null;
    throw error;
  });
  return indexSetupPromise;
}

export async function rawCollection<T extends object>(name: string): Promise<Collection<T>> {
  return (await getDatabase()).collection<T>(name);
}

export async function collection<T extends object>(name: string): Promise<Collection<T>> {
  await ensureIndexes();
  return (await getDatabase()).collection<T>(name);
}
