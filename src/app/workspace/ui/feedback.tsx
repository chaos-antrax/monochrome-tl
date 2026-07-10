import type { ReactNode } from "react";

const statusClasses: Record<string, string> = {
  untranslated: "border-neutral-200 bg-neutral-100 text-neutral-600",
  queued: "border-neutral-300 bg-white text-neutral-800",
  translating: "border-neutral-950 bg-neutral-950 text-white",
  translated: "border-neutral-950 bg-neutral-950 text-white",
  failed:
    "border-neutral-300 bg-white text-neutral-500 line-through decoration-neutral-400",
};

export type TranslationProgressView = {
  percent: number;
  label: string;
};

export function TranslationProgressOverlay({ progress }: { progress?: TranslationProgressView | null }) {
  if (!progress) return null;
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-lg border border-white/70 bg-white/55 px-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md animate-page">
      <div className="w-full max-w-xs rounded-lg border border-neutral-200/80 bg-white/80 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" aria-hidden="true" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Translating</p>
        <p className="mt-1 text-sm font-semibold text-neutral-950">{progress.label}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-neutral-950 transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-neutral-500">{percent}%</p>
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`motion-surface animate-rise rounded-lg border border-neutral-200 bg-white/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.06)] sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function Status({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClasses[status] ?? statusClasses.untranslated}`}
    >
      {status}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-rise rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-6 text-center">
      <h3 className="font-serif text-xl font-semibold text-neutral-950">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
