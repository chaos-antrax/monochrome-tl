import { redirect } from "next/navigation";
import { getSafeUser } from "@/lib/repository";
import { canAccessTranslationPortal } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { AppShell } from "./shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSafeUser(session.userId);
  if (!user || !canAccessTranslationPortal(user.role)) {
    redirect("/api/auth/clear-session?reason=access-revoked");
  }

  return <AppShell>{children}</AppShell>;
}
