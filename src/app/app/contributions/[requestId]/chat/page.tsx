import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getAdminContributionRequest } from "@/lib/contributions/repository";
import { ContributionChatClient } from "./chat-client";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function ContributionChatPage({ params }: PageProps) {
  let userId = "";
  try {
    const { user } = await requireAdminUser();
    userId = user.id;
  } catch {
    redirect("/app/library");
  }

  const { requestId } = await params;
  const item = await getAdminContributionRequest(requestId, userId);
  if (!item) redirect("/app/contributions");
  if (!item.canOpenChat) redirect(`/app/contributions/${requestId}`);
  return <ContributionChatClient request={item} />;
}