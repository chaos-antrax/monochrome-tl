"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import type { AdminContributionDetail } from "@/lib/contributions/types";
import { Card, ConfirmDialog, LoadingButton, primaryButton, secondaryButton, Status } from "../../../workspace/ui";
import { useToast } from "../../../workspace/state";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ContributionDetailClient({ initialItem }: { initialItem: AdminContributionDetail }) {
  const router = useRouter();
  const { setMessage } = useToast();
  const [item, setItem] = useState(initialItem);
  const [confirming, setConfirming] = useState<"accept" | "reject" | null>(null);
  const [mutating, setMutating] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/admin/contributions/${item.id}`);
    const payload = (await response.json()) as { item?: AdminContributionDetail; error?: string };
    if (!response.ok || !payload.item) throw new Error(payload.error || "Failed to refresh request.");
    setItem(payload.item);
    return payload.item;
  }

  async function decide(action: "accept" | "reject") {
    setMutating(true);
    try {
      await refresh();
      const response = await fetch(`/api/admin/contributions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { item?: AdminContributionDetail; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "Failed to update request.");
      setItem(payload.item);
      setMessage(action === "accept" ? "Request accepted. Chat is now open." : "Request rejected.");
      setConfirming(null);
      if (action === "accept") router.push(`/app/contributions/${item.id}/chat`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update request.");
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/app/contributions" className={secondaryButton}>
        <span className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to contributions</span>
      </Link>

      <Card className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Status status={item.status} />
              <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{item.type}</span>
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold text-neutral-950">{item.novelTitle}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.status === "pending" ? (
              <>
                <LoadingButton loading={mutating && confirming === "accept"} disabled={mutating} onClick={() => setConfirming("accept")} className={primaryButton}>Accept</LoadingButton>
                <LoadingButton loading={mutating && confirming === "reject"} disabled={mutating} onClick={() => setConfirming("reject")} className={secondaryButton}>Reject</LoadingButton>
              </>
            ) : null}
            {item.canOpenChat ? (
              <Link href={`/app/contributions/${item.id}/chat`} className={primaryButton}>
                <span className="inline-flex items-center gap-2"><MessageSquareText className="h-4 w-4" />Open chat</span>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Reader</p><p className="mt-2 text-sm font-semibold text-neutral-950">{item.user.username || "Unnamed reader"}</p><p className="mt-1 text-xs text-neutral-500">{item.user.email}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Submitted</p><p className="mt-2 text-sm font-semibold text-neutral-950">{formatDate(item.createdAt)}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Last edited</p><p className="mt-2 text-sm font-semibold text-neutral-950">{formatDate(item.updatedAt)}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Assigned admin</p><p className="mt-2 text-sm font-semibold text-neutral-950">{item.admin ? item.admin.username || item.admin.email : "Unassigned"}</p></div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Request description</p>
          <p className="mt-3 whitespace-pre-line rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700">{item.description}</p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming === "accept"}
        title="Accept and open chat?"
        body="You will be assigned to this request and can begin messaging the reader. The request will use the latest saved reader details."
        confirmLabel="Accept"
        onCancel={() => {
          if (!mutating) setConfirming(null);
        }}
        onConfirm={() => decide("accept")}
      />
      <ConfirmDialog
        open={confirming === "reject"}
        title="Reject this request?"
        body="The reader will no longer be able to edit it, and no chat will be opened. This also frees one pending request slot for the reader."
        confirmLabel="Reject"
        destructive
        onCancel={() => {
          if (!mutating) setConfirming(null);
        }}
        onConfirm={() => decide("reject")}
      />
    </div>
  );
}