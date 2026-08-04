"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, MessageCircle, ShieldCheck, Star, UserCog } from "lucide-react";
import type { UserRole } from "@/lib/roles";
import { Badge, Card, Empty, LoadingButton, Modal, secondaryButton } from "../../../workspace/ui";
import { useToast } from "../../../workspace/state";

type ManagedUser = {
  id: string;
  email: string;
  username?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

type UserActivityItem = {
  id: string;
  kind: "review" | "review-reply" | "comment" | "comment-reply";
  body: string;
  rating?: number;
  novelTitle: string;
  chapterTitle?: string;
  createdAt: string;
  updatedAt?: string;
};

type UserActivity = {
  user: {
    id: string;
    email: string;
    username?: string;
    role: UserRole;
  };
  summary: {
    reviews: number;
    reviewReplies: number;
    comments: number;
    commentReplies: number;
    total: number;
    latestActivityAt?: string;
  };
  items: UserActivityItem[];
};

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function activityLabel(kind: UserActivityItem["kind"]) {
  if (kind === "review") return "Review";
  if (kind === "review-reply") return "Review reply";
  if (kind === "comment") return "Comment";
  return "Comment reply";
}

const userTableGrid = "md:grid-cols-[minmax(18rem,1fr)_8.5rem_12rem_10rem_9rem]";

export function UsersClient() {
  const { setMessage } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activityUser, setActivityUser] = useState<ManagedUser | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

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

  async function loadActivity(user: ManagedUser) {
    setActivityUser(user);
    setActivity(null);
    setActivityLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/activity?limit=50`);
      if (!response.ok) throw new Error(await readError(response, "Unable to load user activity."));
      setActivity((await response.json()) as UserActivity);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load user activity.");
    } finally {
      setActivityLoading(false);
    }
  }

  function closeActivity() {
    setActivityUser(null);
    setActivity(null);
    setActivityLoading(false);
  }

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
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">Admin</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">User management</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/55">
              Reader is the default role. Grant writer access only to users who should enter the translation portal.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.14em] text-foreground/55">
            <span className="rounded-lg bg-foreground/[0.06] px-3 py-2">{counts.admins} admin</span>
            <span className="rounded-lg bg-foreground/[0.06] px-3 py-2">{counts.writers} writer</span>
            <span className="rounded-lg bg-foreground/[0.06] px-3 py-2">{counts.readers} reader</span>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-foreground/[0.06]" />)}
          </div>
        ) : users.length === 0 ? (
          <Empty title="No users found" body="Users will appear here after they sign up." />
        ) : (
          <div className="overflow-hidden border border-foreground/10">
            <div className={`hidden ${userTableGrid} border-b border-foreground/10 bg-foreground/[0.025] px-4 py-3 text-xs font-light uppercase tracking-[0.16em] text-foreground/55 md:grid md:items-center`}>
              <span className="min-w-0">User</span>
              <span className="min-w-0">Role</span>
              <span className="min-w-0">Updated</span>
              <span className="min-w-0 text-right">Writer access</span>
              <span className="min-w-0 text-right">Activity</span>
            </div>
            <div className="divide-y divide-foreground/10">
              {users.map((user) => {
                const isAdmin = user.role === "admin";
                const isWriter = user.role === "writer";
                return (
                  <div key={user.id} className={`grid gap-3 px-4 py-4 md:min-h-[5.25rem] md:gap-0 ${userTableGrid} md:items-center`}>
                    <div className="min-w-0 md:pr-5">
                      <div className="flex items-center gap-2">
                        {isAdmin ? <ShieldCheck aria-hidden="true" className="h-4 w-4 text-foreground" /> : <UserCog aria-hidden="true" className="h-4 w-4 text-foreground/40" />}
                        <p className="truncate font-semibold text-foreground">{user.username || "Unnamed user"}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-foreground/55">{user.email}</p>
                      <p className="mt-1 text-xs text-foreground/55">Joined {formatDate(user.createdAt)}</p>
                    </div>
                    <div className="flex min-w-0 items-center">
                      <Badge active={user.role === "admin"}>{user.role}</Badge>
                    </div>
                    <span className="min-w-0 text-sm font-light text-foreground/55">{formatDate(user.updatedAt)}</span>
                    <div className="flex min-w-0 justify-start md:justify-end">
                      <LoadingButton
                        type="button"
                        loading={updatingId === user.id}
                        loadingLabel="Updating ..."
                        disabled={isAdmin || (Boolean(updatingId) && updatingId !== user.id)}
                        onClick={() => setWriter(user, !isWriter)}
                        className={`inline-flex min-h-10 min-w-32 items-center justify-center border px-4 py-2 font-inter text-xs font-light transition disabled:cursor-not-allowed disabled:opacity-40 ${isWriter ? "border-foreground/15 bg-transparent text-foreground hover:bg-foreground/[0.04]" : "border-foreground bg-foreground text-background hover:bg-foreground/90"}`}
                      >
                        {isAdmin ? "Protected" : isWriter ? "Remove writer" : "Make writer"}
                      </LoadingButton>
                    </div>
                    <div className="flex min-w-0 justify-start md:justify-end">
                      <LoadingButton
                        type="button"
                        loading={activityLoading && activityUser?.id === user.id}
                        loadingLabel="Loading ..."
                        onClick={() => void loadActivity(user)}
                        className="inline-flex min-h-10 min-w-28 items-center justify-center gap-2 border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Activity aria-hidden="true" className="h-3.5 w-3.5" />
                          Activity
                        </span>
                      </LoadingButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <Modal title="Reader activity" open={Boolean(activityUser)} onClose={closeActivity}>
        {activityLoading ? (
          <div className="flex min-h-72 items-center justify-center text-center">
            <div>
              <span aria-hidden="true" className="mx-auto block h-8 w-8 animate-spin rounded-full border border-foreground/20 border-t-foreground" />
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-foreground/55">Loading activity</p>
            </div>
          </div>
        ) : activity ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 border-b border-foreground/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-serif text-2xl font-light text-foreground">{activity.user.username || "Unnamed user"}</p>
                <p className="mt-1 truncate text-sm font-light text-foreground/55">{activity.user.email}</p>
              </div>
              <Badge active={activity.user.role === "admin"}>{activity.user.role}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ActivityCount label="Reviews" value={activity.summary.reviews} />
              <ActivityCount label="Review replies" value={activity.summary.reviewReplies} />
              <ActivityCount label="Comments" value={activity.summary.comments} />
              <ActivityCount label="Comment replies" value={activity.summary.commentReplies} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-light uppercase tracking-[0.16em] text-foreground/55">
                {activity.summary.total} total item{activity.summary.total === 1 ? "" : "s"}
                {activity.summary.latestActivityAt ? ` / Latest ${formatDate(activity.summary.latestActivityAt)}` : ""}
              </p>
              {activityUser ? (
                <button type="button" onClick={() => void loadActivity(activityUser)} className={secondaryButton}>
                  Refresh
                </button>
              ) : null}
            </div>

            {activity.items.length === 0 ? (
              <Empty title="No reader activity" body="This user has not posted reviews, comments, or replies yet." />
            ) : (
              <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                {activity.items.map((item) => <ActivityRow key={`${item.kind}-${item.id}`} item={item} />)}
              </div>
            )}
          </div>
        ) : (
          <Empty title="Activity unavailable" body="The activity request did not return any data." />
        )}
      </Modal>
    </div>
  );
}

function ActivityCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-foreground/10 bg-foreground/[0.025] p-3">
      <p className="font-serif text-2xl font-light text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-light uppercase tracking-[0.14em] text-foreground/50">{label}</p>
    </div>
  );
}

function ActivityRow({ item }: { item: UserActivityItem }) {
  const isReview = item.kind.startsWith("review");
  return (
    <article className="grid grid-cols-[auto_1fr] gap-3 border border-foreground/10 bg-[var(--surface)] p-4">
      <span className="mt-0.5 text-foreground/65">
        {isReview ? <Star aria-hidden="true" className="h-4 w-4" fill={typeof item.rating === "number" ? "currentColor" : "none"} /> : <MessageCircle aria-hidden="true" className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-light uppercase tracking-[0.16em] text-foreground/50">
          <span>{activityLabel(item.kind)}</span>
          {typeof item.rating === "number" ? <span>{item.rating}/5</span> : null}
          <time>{formatDate(item.createdAt)}</time>
        </div>
        <h3 className="mt-2 truncate font-serif text-lg font-light text-foreground">{item.chapterTitle || item.novelTitle}</h3>
        {item.chapterTitle ? <p className="mt-1 truncate text-xs font-light text-foreground/45">{item.novelTitle}</p> : null}
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm font-light leading-6 text-foreground/65">{item.body}</p>
      </div>
    </article>
  );
}
