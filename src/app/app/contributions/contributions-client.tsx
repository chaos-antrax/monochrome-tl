"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageSquareText, RefreshCw, Search } from "lucide-react";
import type { AdminContributionListItem, AdminContributionListResponse, ContributionRequestStatus } from "@/lib/contributions/types";
import { Badge, Card, CustomSelect, Empty, Input, LoadingButton, secondaryButton, Status, subtleButton } from "../../workspace/ui";
import { useToast } from "../../workspace/state";

type Tab = "pending" | "active" | "rejected" | "all";

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active chats" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const typeOptions = [
  { value: "all", label: "All types" },
  { value: "translation", label: "Translation" },
  { value: "contribution", label: "Contribution" },
];

const sortOptions = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusForTab(tab: Tab): ContributionRequestStatus | undefined {
  if (tab === "active") return "accepted";
  if (tab === "rejected") return "rejected";
  if (tab === "pending") return "pending";
  return undefined;
}

export function ContributionsClient() {
  const { setMessage } = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("oldest");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AdminContributionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryBase = useMemo(() => {
    const params = new URLSearchParams();
    const status = statusForTab(tab);
    if (status) params.set("status", status);
    if (tab === "active") params.set("assignee", "me");
    if (type !== "all") params.set("type", type);
    if (search.trim()) params.set("search", search.trim());
    params.set("sort", tab === "pending" && sort === "updated" ? "oldest" : sort);
    return params;
  }, [search, sort, tab, type]);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams(queryBase);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/admin/contributions?${params.toString()}`);
      const payload = (await response.json()) as AdminContributionListResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load requests.");
      setItems((current) => (cursor ? [...current, ...payload.items] : payload.items));
      setNextCursor(payload.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load requests.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [queryBase, setMessage]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="space-y-5">
      <header className="border border-foreground/10 bg-[var(--surface)] p-6 shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">Admin</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-foreground">Contributions</h1>
          </div>
          <button type="button" onClick={() => load()} className={secondaryButton}>
            <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Refresh</span>
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/55">
          Review reader translation requests, accept work you will own, and continue accepted request chats.
        </p>
      </header>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item.value} type="button" onClick={() => setTab(item.value)} className={`border px-4 py-2 font-inter text-xs font-light transition ${tab === item.value ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-transparent text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Input label="Search" value={search} onChange={setSearch} placeholder="Novel title, description, reader email" />
            <Search aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-foreground/40" />
          </div>
          <CustomSelect label="Type" value={type} onChange={setType} options={typeOptions} />
          <CustomSelect label="Sort" value={sort} onChange={setSort} options={sortOptions} />
        </div>
      </Card>

      <div className="grid gap-3">
        {loading ? (
          <Card><p className="text-sm text-foreground/55">Loading contribution requests ...</p></Card>
        ) : items.length ? (
          items.map((item) => (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Status status={item.status} />
                    <Badge>{item.type}</Badge>
                  </div>
                  <h2 className="mt-3 truncate font-serif text-2xl font-semibold text-foreground">{item.novelTitle}</h2>
                  <p className="mt-2 max-h-16 overflow-hidden text-sm leading-6 text-foreground/60">{item.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/55">
                    <span>Reader: {item.user.username || "Unnamed reader"}</span>
                    <span>Email: {item.user.email}</span>
                    <span>Submitted {formatDate(item.createdAt)}</span>
                    {item.updatedAt !== item.createdAt ? <span>Edited {formatDate(item.updatedAt)}</span> : null}
                    {item.admin ? (
                      <>
                        <span>Admin: {item.admin.username || item.admin.email}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  {item.status === "accepted" && item.adminId ? (
                    <Link href={`/app/contributions/${item.id}/chat`} className={secondaryButton}>
                      <span className="inline-flex items-center gap-2"><MessageSquareText className="h-4 w-4" />Chat</span>
                    </Link>
                  ) : null}
                  <Link href={`/app/contributions/${item.id}`} className={subtleButton}>
                    <span className="inline-flex items-center gap-2">Details<ArrowRight className="h-4 w-4" /></span>
                  </Link>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Empty title="No requests found" body="Nothing matches the current filters yet." />
        )}
      </div>

      {nextCursor ? (
        <div className="flex justify-center">
          <LoadingButton loading={loadingMore} loadingLabel="Loading ..." onClick={() => load(nextCursor)} className={secondaryButton}>Load more</LoadingButton>
        </div>
      ) : null}
    </div>
  );
}





