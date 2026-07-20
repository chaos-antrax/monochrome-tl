import { redirect } from "next/navigation";
import { getSafeUser } from "@/lib/repository";
import { canAccessTranslationPortal } from "@/lib/roles";
import { clearSessionCookie, getSession } from "@/lib/session";
import { AppShell } from "./shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSafeUser(session.userId);
  if (!user || !canAccessTranslationPortal(user.role)) {
    await clearSessionCookie();
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
