import { redirect } from "next/navigation";
import { getSafeUser } from "@/lib/repository";
import { canAccessTranslationPortal } from "@/lib/roles";
import { clearSessionCookie, getSession } from "@/lib/session";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    const user = await getSafeUser(session.userId);
    if (user && canAccessTranslationPortal(user.role)) redirect("/app/library");
    await clearSessionCookie();
  }
  return <LoginClient />;
}
