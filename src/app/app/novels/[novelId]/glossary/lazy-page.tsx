"use client";

import dynamic from "next/dynamic";

const GlossaryClientPage = dynamic(() => import("./client-page"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <div className="h-3 w-24 animate-pulse rounded bg-foreground/10" />
      <div className="mt-4 h-9 w-64 max-w-full animate-pulse rounded bg-foreground/10" />
      <div className="mt-6 grid gap-3">
        <div className="h-20 animate-pulse rounded-lg bg-foreground/[0.06]" />
        <div className="h-20 animate-pulse rounded-lg bg-foreground/[0.06]" />
      </div>
    </div>
  ),
});

export default function LazyGlossaryPage() {
  return <GlossaryClientPage />;
}