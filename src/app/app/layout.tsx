import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "./shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell>{children}</AppShell>;
}