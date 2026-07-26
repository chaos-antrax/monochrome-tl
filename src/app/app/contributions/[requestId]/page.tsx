import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getAdminContributionRequest } from "@/lib/contributions/repository";
import { ContributionDetailClient } from "./detail-client";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function ContributionDetailPage({ params }: PageProps) {
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
  return <ContributionDetailClient initialItem={item} />;
}