import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app/library");
  return <LoginClient />;
}