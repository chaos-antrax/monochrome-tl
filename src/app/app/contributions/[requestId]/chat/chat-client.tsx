"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import type { AdminContributionDetail, AdminContributionMessage } from "@/lib/contributions/types";
import { Card, Empty, LoadingButton, secondaryButton, Textarea } from "../../../../workspace/ui";
import { useToast } from "../../../../workspace/state";

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function ContributionChatClient({ request }: { request: AdminContributionDetail }) {
  const { setMessage } = useToast();
  const [messages, setMessages] = useState<AdminContributionMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await fetch(`/api/admin/contributions/${request.id}/messages`);
      const payload = (await response.json()) as { messages?: AdminContributionMessage[]; error?: string };
      if (!response.ok || !payload.messages) throw new Error(payload.error || "Failed to load messages.");
      setMessages(payload.messages);
    } catch (error) {
      if (!background) setMessage(error instanceof Error ? error.message : "Failed to load messages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request.id, setMessage]);

  async function sendMessage() {
    const trimmed = body.trim();
    if (!trimmed) {
      setMessage("Message cannot be empty.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch(`/api/admin/contributions/${request.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const payload = (await response.json()) as { message?: AdminContributionMessage; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || "Failed to send message.");
      setMessages((current) => [...current, payload.message!]);
      setBody("");
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 30);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMessages();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages(true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [loading]);

  return (
    <div className="space-y-5">
      <Link href={`/app/contributions/${request.id}`} className={secondaryButton}>
        <span className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Request detail</span>
      </Link>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-foreground/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">{request.type} request</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground">{request.novelTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/60">{request.description}</p>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.025] px-3 py-2 text-xs text-foreground/55">
            <p>Reader: <span className="font-semibold text-foreground/80">{request.user.username || "Unnamed reader"}</span></p>
            <p className="mt-1 truncate">{request.user.email}</p>
            <p className="mt-1">{refreshing ? "Refreshing ..." : "Polling every 10 seconds"}</p>
          </div>
        </div>

        <div className="min-h-[24rem] space-y-3 overflow-y-auto rounded-lg border border-foreground/10 bg-foreground/[0.025] p-3 sm:p-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-16 w-3/4 animate-pulse rounded-lg bg-foreground/10" />
              <div className="ml-auto h-16 w-2/3 animate-pulse rounded-lg bg-foreground/10" />
            </div>
          ) : messages.length ? (
            messages.map((message) => {
              const fromAdmin = message.senderRole === "admin";
              return (
                <div key={message.id} className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[min(36rem,88%)] rounded-lg border px-4 py-3 shadow-sm ${fromAdmin ? "border-foreground bg-foreground text-background" : "border-foreground/10 bg-[var(--surface)] text-foreground/90"}`}>
                    <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                      <span>{fromAdmin ? "Admin" : message.sender?.username || message.sender?.email || "Reader"}</span>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">{message.body}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty title="No messages yet" body="Send the first message to the reader once you are ready to continue this accepted request." />
          )}
          <div ref={bottomRef} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <Textarea label="Message" value={body} onChange={setBody} rows={3} placeholder="Write a message to the reader" />
          <LoadingButton loading={sending} loadingLabel="Sending ..." onClick={sendMessage} disabled={body.trim().length === 0}>
            <span className="inline-flex items-center gap-2"><Send className="h-4 w-4" />Send</span>
          </LoadingButton>
        </div>
      </Card>
    </div>
  );
}