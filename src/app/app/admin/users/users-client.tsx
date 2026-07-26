"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog } from "lucide-react";
import type { UserRole } from "@/lib/roles";
import { Card, Empty, LoadingButton } from "../../../workspace/ui";
import { useToast } from "../../../workspace/state";

type ManagedUser = {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function UsersClient() {
  const { setMessage } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const response = await fetch("/api/admin/users");
        if (!response.ok) throw new Error(await readError(response, "Unable to load users."));
        const data = (await response.json()) as { users: ManagedUser[] };
        if (!cancelled) setUsers(data.users);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load users.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadUsers();
    return () => { cancelled = true; };
  }, [setMessage]);

  const counts = useMemo(() => ({
    admins: users.filter((user) => user.role === "admin").length,
    writers: users.filter((user) => user.role === "writer").length,
    readers: users.filter((user) => user.role === "reader").length,
  }), [users]);

  async function setWriter(user: ManagedUser, writer: boolean) {
    if (user.role === "admin" || updatingId) return;
    setUpdatingId(user.id);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id, writer }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to update user."));
      const data = (await response.json()) as { user: { id: string; role: UserRole } };
      setUsers((current) => current.map((item) => item.id === data.user.id ? { ...item, role: data.user.role, updatedAt: new Date().toISOString() } : item));
      setMessage(writer ? `Writer access granted to ${user.email}.` : `Writer access removed from ${user.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="animate-page space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Admin</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">User management</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
              Reader is the default role. Grant writer access only to users who should enter the translation portal.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.14em] text-neutral-500">
            <span className="rounded-lg bg-neutral-100 px-3 py-2">{counts.admins} admin</span>
            <span className="rounded-lg bg-neutral-100 px-3 py-2">{counts.writers} writer</span>
            <span className="rounded-lg bg-neutral-100 px-3 py-2">{counts.readers} reader</span>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-neutral-100" />)}
          </div>
        ) : users.length === 0 ? (
          <Empty title="No users found" body="Users will appear here after they sign up." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_190px_150px] border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 md:grid">
              <span>User</span>
              <span>Role</span>
              <span>Updated</span>
              <span className="text-right">Writer access</span>
            </div>
            <div className="divide-y divide-neutral-200">
              {users.map((user) => {
                const isAdmin = user.role === "admin";
                const isWriter = user.role === "writer";
                return (
                  <div key={user.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_140px_190px_150px] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isAdmin ? <ShieldCheck aria-hidden="true" className="h-4 w-4 text-neutral-950" /> : <UserCog aria-hidden="true" className="h-4 w-4 text-neutral-400" />}
                        <p className="truncate font-semibold text-neutral-950">{user.username || "Unnamed user"}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-neutral-500">{user.email}</p>
                      <p className="mt-1 text-xs text-neutral-500">Joined {formatDate(user.createdAt)}</p>
                    </div>
                    <span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">{user.role}</span>
                    <span className="text-sm text-neutral-500">{formatDate(user.updatedAt)}</span>
                    <div className="flex justify-start md:justify-end">
                      <LoadingButton
                        type="button"
                        loading={updatingId === user.id}
                        loadingLabel="Updating ..."
                        disabled={isAdmin || (Boolean(updatingId) && updatingId !== user.id)}
                        onClick={() => setWriter(user, !isWriter)}
                        className={`min-w-32 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${isWriter ? "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-950 disabled:text-neutral-300" : "bg-neutral-950 text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"}`}
                      >
                        {isAdmin ? "Protected" : isWriter ? "Remove writer" : "Make writer"}
                      </LoadingButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}




