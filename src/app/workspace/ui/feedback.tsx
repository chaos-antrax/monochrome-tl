import type { ReactNode } from "react";

const badgeBase =
  "inline-flex w-fit items-center border px-2.5 py-1 text-[10px] font-light uppercase tracking-[0.14em]";

const badgeToneClasses = {
  default: "border-foreground/15 bg-foreground/[0.035] text-foreground/65",
  active: "border-foreground bg-foreground text-background",
  muted: "border-foreground/10 bg-transparent text-foreground/45",
};

const statusClasses: Record<string, string> = {
  untranslated: badgeToneClasses.default,
  queued: badgeToneClasses.default,
  translating: badgeToneClasses.active,
  translated: badgeToneClasses.active,
  accepted: badgeToneClasses.active,
  pending: badgeToneClasses.default,
  rejected: `${badgeToneClasses.muted} line-through decoration-foreground/40`,
  failed: `${badgeToneClasses.muted} line-through decoration-foreground/40`,
};

export type TranslationProgressView = {
  percent: number;
  label: string;
};

export function TranslationProgressOverlay({ progress }: { progress?: TranslationProgressView | null }) {
  if (!progress) return null;
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
  return (
    <div className="absolute inset-0 z-10 grid place-items-center border border-foreground/10 bg-background/55 px-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md animate-page">
      <div className="w-full max-w-xs border border-foreground/15 bg-background/85 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" aria-hidden="true" />
        <p className="mt-3 text-[11px] font-light uppercase tracking-[0.18em] text-foreground/55">Translating</p>
        <p className="mt-1 text-sm font-light text-foreground">{progress.label}</p>
        <div className="mt-4 h-1.5 overflow-hidden bg-foreground/10">
          <div className="h-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs font-light text-foreground/55">{percent}%</p>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`motion-surface animate-rise border border-foreground/10 bg-[var(--surface)] p-5 shadow-none sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function Status({ status }: { status: string }) {
  return (
    <span
      className={`${badgeBase} ${statusClasses[status] ?? statusClasses.untranslated}`}
    >
      {status}
    </span>
  );
}

export function Badge({
  children,
  active = false,
  muted = false,
}: {
  children: ReactNode;
  active?: boolean;
  muted?: boolean;
}) {
  const tone = active ? badgeToneClasses.active : muted ? badgeToneClasses.muted : badgeToneClasses.default;
  return <span className={`${badgeBase} ${tone}`}>{children}</span>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="animate-rise border border-dashed border-foreground/15 bg-[var(--surface)] p-6 text-center">
      <h3 className="font-serif text-xl font-light text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-light leading-6 text-foreground/60">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

