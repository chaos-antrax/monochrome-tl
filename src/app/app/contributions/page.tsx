import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { ContributionsClient } from "./contributions-client";

export default async function ContributionsPage() {
  try {
    await requireAdminUser();
  } catch {
    redirect("/app/library");
  }

  return <ContributionsClient />;
}
