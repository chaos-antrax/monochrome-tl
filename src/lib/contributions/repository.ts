import type { Filter, Sort, UpdateFilter } from "mongodb";
import crypto from "node:crypto";
import { AuthError } from "@/lib/auth";
import { collection, rawCollection } from "@/lib/repository/indexes";
import type { UserDocument } from "@/lib/repository/types";
import { fallbackUser, mapContributionDetail, mapContributionMessage, mapUserSummary, toObjectIds } from "./mappers";
import type {
  AdminContributionDetail,
  AdminContributionListInput,
  AdminContributionListItem,
  AdminContributionListResponse,
  AdminContributionMessage,
  ContributionAuditEvent,
  ContributionMessage,
  ContributionRequest,
  ContributionRequestStatus,
  ContributionRequestType,
  ContributionUserSummary,
} from "./types";

const REQUEST_STATUSES: ContributionRequestStatus[] = ["pending", "accepted", "rejected"];
const REQUEST_TYPES: ContributionRequestType[] = ["translation", "contribution"];

export function isContributionStatus(value: unknown): value is ContributionRequestStatus {
  return typeof value === "string" && REQUEST_STATUSES.includes(value as ContributionRequestStatus);
}

export function isContributionType(value: unknown): value is ContributionRequestType {
  return typeof value === "string" && REQUEST_TYPES.includes(value as ContributionRequestType);
}

export async function contributionRequestsCollection() {
  return collection<ContributionRequest>("readerContributionRequests");
}

export async function contributionMessagesCollection() {
  return collection<ContributionMessage>("readerContributionMessages");
}

export async function contributionAuditCollection() {
  return collection<ContributionAuditEvent>("readerContributionAudit");
}

async function usersRawCollection() {
  return rawCollection<UserDocument>("users");
}

function clampLimit(value?: number) {
  if (!Number.isFinite(value)) return 25;
  return Math.min(Math.max(Math.floor(value ?? 25), 1), 50);
}

function parseOffset(cursor?: string) {
  if (!cursor) return 0;
  const offset = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

function encodeOffset(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findUserSummaries(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const objectIds = toObjectIds(uniqueIds);
  const summaries = new Map<string, ContributionUserSummary>();

  if (!objectIds.length) return summaries;

  const users = await (await usersRawCollection())
    .find(
      { _id: { $in: objectIds } },
      { projection: { email: 1, username: 1 } },
    )
    .toArray();

  for (const user of users) {
    const summary = mapUserSummary(user as UserDocument & { username?: string });
    summaries.set(summary.id, summary);
  }

  return summaries;
}

async function findUserIdsForSearch(search: string) {
  const objectIds = toObjectIds([search]);
  const expression = new RegExp(escapeRegex(search), "i");
  const users = await (await usersRawCollection())
    .find(
      {
        $or: [{ email: expression }, { username: expression }, ...(objectIds.length ? [{ _id: { $in: objectIds } }] : [])],
      },
      { projection: { _id: 1 } },
    )
    .toArray();

  return users.map((user) => user._id.toHexString());
}

async function enrichRequests(requests: ContributionRequest[], currentAdminId: string): Promise<AdminContributionDetail[]> {
  const userIds = requests.map((request) => request.userId);
  const adminIds = requests.map((request) => request.adminId).filter((id): id is string => Boolean(id));
  const userSummaries = await findUserSummaries([...userIds, ...adminIds]);

  return requests.map((request) =>
    mapContributionDetail(
      request,
      userSummaries.get(request.userId) ?? fallbackUser(request.userId),
      request.adminId ? userSummaries.get(request.adminId) : undefined,
      currentAdminId,
    ),
  );
}

function detailToListItem(detail: AdminContributionDetail): AdminContributionListItem {
  return {
    id: detail.id,
    type: detail.type,
    novelTitle: detail.novelTitle,
    description: detail.description,
    status: detail.status,
    adminId: detail.adminId,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    acceptedAt: detail.acceptedAt,
    rejectedAt: detail.rejectedAt,
    user: detail.user,
    admin: detail.admin,
  };
}

export async function listAdminContributionRequests(input: AdminContributionListInput): Promise<AdminContributionListResponse> {
  const limit = clampLimit(input.limit);
  const offset = parseOffset(input.cursor);
  const filters: Filter<ContributionRequest>[] = [];

  if (input.status) filters.push({ status: input.status });
  if (input.type) filters.push({ type: input.type });
  if (input.assignee === "me") filters.push({ adminId: input.currentAdminId });

  const search = input.search?.trim();
  if (search) {
    const userIds = await findUserIdsForSearch(search);
    const expression = new RegExp(escapeRegex(search), "i");
    filters.push({
      $or: [{ novelTitle: expression }, { description: expression }, ...userIds.map((userId) => ({ userId }))],
    });
  }

  const sort: Sort =
    input.sort === "newest"
      ? { createdAt: -1, id: 1 }
      : input.sort === "updated"
        ? { updatedAt: -1, id: 1 }
        : { createdAt: 1, id: 1 };

  const query: Filter<ContributionRequest> = filters.length ? { $and: filters } : {};
  const rows = await (await contributionRequestsCollection()).find(query).sort(sort).skip(offset).limit(limit + 1).toArray();
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = (await enrichRequests(pageRows, input.currentAdminId)).map(detailToListItem);

  return { items, nextCursor: hasMore ? encodeOffset(offset + limit) : undefined };
}

export async function getAdminContributionRequest(requestId: string, currentAdminId: string) {
  const request = await (await contributionRequestsCollection()).findOne({ id: requestId });
  if (!request) return null;
  const [detail] = await enrichRequests([request], currentAdminId);
  return detail;
}

async function audit(requestId: string, actorId: string, action: ContributionAuditEvent["action"], metadata?: Record<string, unknown>) {
  await (await contributionAuditCollection()).insertOne({
    id: crypto.randomUUID(),
    requestId,
    actorId,
    action,
    metadata,
    createdAt: new Date(),
  });
}

export async function decideContributionRequest(requestId: string, currentAdminId: string, action: "accept" | "reject") {
  const now = new Date();
  const update: UpdateFilter<ContributionRequest> =
    action === "accept"
      ? {
          $set: { status: "accepted" as const, adminId: currentAdminId, acceptedAt: now, updatedAt: now },
          $unset: { rejectedAt: "" as const },
        }
      : {
          $set: { status: "rejected" as const, adminId: currentAdminId, rejectedAt: now, updatedAt: now },
          $unset: { acceptedAt: "" as const },
        };

  const result = await (await contributionRequestsCollection()).findOneAndUpdate(
    { id: requestId, status: "pending" },
    update,
    { returnDocument: "after" },
  );

  if (!result) {
    const existing = await (await contributionRequestsCollection()).findOne({ id: requestId });
    if (!existing) throw new AuthError(404, "Contribution request not found");
    throw new AuthError(409, "Contribution request has already been processed");
  }

  await audit(requestId, currentAdminId, action === "accept" ? "accepted" : "rejected");
  const [detail] = await enrichRequests([result], currentAdminId);
  return detail;
}

export async function listAdminContributionMessages(requestId: string, currentAdminId: string, after?: Date): Promise<AdminContributionMessage[]> {
  const request = await (await contributionRequestsCollection()).findOne({ id: requestId });
  if (!request) throw new AuthError(404, "Contribution request not found");
  if (request.status !== "accepted" || request.adminId !== currentAdminId) {
    throw new AuthError(403, "You are not assigned to this chat");
  }

  const messageFilter: Filter<ContributionMessage> = after ? { requestId, createdAt: { $gt: after } } : { requestId };
  const messages = await (await contributionMessagesCollection()).find(messageFilter).sort({ createdAt: 1 }).toArray();
  const senderSummaries = await findUserSummaries(messages.map((message) => message.senderId));
  return messages.map((message) => mapContributionMessage(message, senderSummaries.get(message.senderId)));
}

export async function createAdminContributionMessage(requestId: string, currentAdminId: string, body: string) {
  const request = await (await contributionRequestsCollection()).findOne({ id: requestId });
  if (!request) throw new AuthError(404, "Contribution request not found");
  if (request.status !== "accepted" || request.adminId !== currentAdminId) {
    throw new AuthError(403, "You are not assigned to this chat");
  }

  const message: ContributionMessage = {
    id: crypto.randomUUID(),
    requestId,
    senderId: currentAdminId,
    senderRole: "admin",
    body,
    createdAt: new Date(),
  };

  await (await contributionMessagesCollection()).insertOne(message);
  await (await contributionRequestsCollection()).updateOne({ id: requestId }, { $set: { updatedAt: new Date() } });
  await audit(requestId, currentAdminId, "admin_message_sent");

  const adminSummary = (await findUserSummaries([currentAdminId])).get(currentAdminId);
  return mapContributionMessage(message, adminSummary);
}



