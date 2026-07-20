import { redirect } from "next/navigation";
import { getSafeUser } from "@/lib/repository";
import { canAccessTranslationPortal } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { LoginClient } from "./login-client";

type LoginPageProps = {
  searchParams?: Promise<{ reason?: string }>;
};

function loginMessage(reason?: string) {
  if (reason === "access-revoked") {
    return "Your writer access has been removed. You can still use the reader app, but an admin must restore writer access before you can enter the translation portal.";
  }
  return "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const reason = params?.reason;
  const session = await getSession();
  if (session) {
    const user = await getSafeUser(session.userId);
    if (user && canAccessTranslationPortal(user.role)) redirect("/app/library");
    redirect("/api/auth/clear-session?reason=access-revoked");
  }
  return <LoginClient initialMessage={loginMessage(reason)} />;
}
