import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/repository/types";
import type { AdminContributionDetail, AdminContributionListItem, AdminContributionMessage, ContributionMessage, ContributionRequest, ContributionUserSummary } from "./types";

function toIso(value?: Date | string) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function mapUserSummary(user: Pick<UserDocument, "_id" | "email"> & { username?: string }, fallbackId = ""): ContributionUserSummary {
  return { id: user._id?.toHexString() ?? fallbackId, email: user.email, username: typeof user.username === "string" ? user.username : undefined };
}

export function fallbackUser(id: string): ContributionUserSummary {
  return { id, email: "Unknown user" };
}

export function toObjectIds(ids: string[]) {
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
}

export function mapContributionListItem(request: ContributionRequest, user: ContributionUserSummary | undefined, admin?: ContributionUserSummary): AdminContributionListItem {
  return {
    id: request.id,
    type: request.type,
    novelTitle: request.novelTitle,
    description: request.description,
    status: request.status,
    adminId: request.adminId,
    createdAt: toIso(request.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(request.updatedAt) ?? new Date().toISOString(),
    acceptedAt: toIso(request.acceptedAt),
    rejectedAt: toIso(request.rejectedAt),
    user: user ?? fallbackUser(request.userId),
    admin,
  };
}

export function mapContributionDetail(request: ContributionRequest, user: ContributionUserSummary | undefined, admin: ContributionUserSummary | undefined, currentAdminId: string): AdminContributionDetail {
  return { ...mapContributionListItem(request, user, admin), canOpenChat: request.status === "accepted" && request.adminId === currentAdminId };
}

export function mapContributionMessage(message: ContributionMessage, sender?: ContributionUserSummary): AdminContributionMessage {
  return { id: message.id, requestId: message.requestId, senderId: message.senderId, senderRole: message.senderRole, body: message.body, createdAt: toIso(message.createdAt) ?? new Date().toISOString(), sender };
}
