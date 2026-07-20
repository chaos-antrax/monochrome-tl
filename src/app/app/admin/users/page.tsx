import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  try {
    await requireAdminUser();
  } catch {
    redirect("/app/library");
  }

  return <UsersClient />;
}
