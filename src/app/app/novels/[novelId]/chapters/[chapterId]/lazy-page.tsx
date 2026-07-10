"use client";

import dynamic from "next/dynamic";

const ReaderClientPage = dynamic(() => import("./client-page"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-neutral-200 bg-white/80 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="mt-4 h-9 w-64 max-w-full animate-pulse rounded bg-neutral-200" />
      <div className="mt-6 grid gap-3">
        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  ),
});

export default function LazyReaderPage() {
  return <ReaderClientPage />;
}