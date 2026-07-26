import type { ObjectId } from "mongodb";

export type ContributionRequestType = "translation" | "contribution";
export type ContributionRequestStatus = "pending" | "accepted" | "rejected";
export type ContributionSenderRole = "reader" | "admin";
export type ContributionSort = "oldest" | "newest" | "updated";
export type ContributionAssignee = "me" | "all";

export type ContributionRequest = {
  _id?: ObjectId;
  id: string;
  userId: string;
  type: ContributionRequestType;
  novelTitle: string;
  description: string;
  status: ContributionRequestStatus;
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
};

export type ContributionMessage = {
  _id?: ObjectId;
  id: string;
  requestId: string;
  senderId: string;
  senderRole: ContributionSenderRole;
  body: string;
  createdAt: Date;
};

export type ContributionAuditEvent = {
  _id?: ObjectId;
  id: string;
  requestId: string;
  actorId: string;
  action: "accepted" | "rejected" | "reassigned" | "admin_message_sent";
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type ContributionUserSummary = { id: string; email: string; username?: string };

export type AdminContributionListItem = {
  id: string;
  type: ContributionRequestType;
  novelTitle: string;
  description: string;
  status: ContributionRequestStatus;
  adminId?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  user: ContributionUserSummary;
  admin?: ContributionUserSummary;
};

export type AdminContributionDetail = AdminContributionListItem & { canOpenChat: boolean };

export type AdminContributionMessage = {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: ContributionSenderRole;
  body: string;
  createdAt: string;
  sender?: ContributionUserSummary;
};

export type AdminContributionListInput = {
  currentAdminId: string;
  status?: ContributionRequestStatus;
  type?: ContributionRequestType;
  assignee?: ContributionAssignee;
  search?: string;
  sort?: ContributionSort;
  cursor?: string;
  limit?: number;
};

export type AdminContributionListResponse = { items: AdminContributionListItem[]; nextCursor?: string };
