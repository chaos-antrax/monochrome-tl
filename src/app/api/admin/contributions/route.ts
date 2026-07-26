import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireAdminUser } from "@/lib/auth";
import { isContributionStatus, isContributionType, listAdminContributionRequests } from "@/lib/contributions/repository";
import type { ContributionAssignee, ContributionSort } from "@/lib/contributions/types";

const SORTS: ContributionSort[] = ["oldest", "newest", "updated"];
const ASSIGNEES: ContributionAssignee[] = ["me", "all"];

const QuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  assignee: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireAdminUser();
    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const status = isContributionStatus(query.status) ? query.status : undefined;
    const type = isContributionType(query.type) ? query.type : undefined;
    const assignee = ASSIGNEES.includes(query.assignee as ContributionAssignee) ? (query.assignee as ContributionAssignee) : "all";
    const sort = SORTS.includes(query.sort as ContributionSort) ? (query.sort as ContributionSort) : "oldest";

    const result = await listAdminContributionRequests({
      currentAdminId: user.id,
      status: status ?? "pending",
      type,
      assignee,
      search: query.search,
      sort,
      cursor: query.cursor,
      limit: query.limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Failed to load contribution requests.");
  }
}
