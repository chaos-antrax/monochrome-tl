"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

type ReaderProps = { text: string; fontSize: number; lineHeight: number };
type SelectOption = { value: string; label: string; description?: string; disabled?: boolean };

export function formatChangedFields(fields: string[]) {
  if (fields.length === 0) return "no fields";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

export function normalizeDisplayText(value: string) {
  const text = value.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.includes("\n") || text.length < 520) return text;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 520 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs.join("\n\n");
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

const statusClasses: Record<string, string> = {
  untranslated: "border-neutral-200 bg-neutral-100 text-neutral-600",
  queued: "border-neutral-300 bg-white text-neutral-800",
  translating: "border-neutral-950 bg-neutral-950 text-white",
  translated: "border-neutral-950 bg-neutral-950 text-white",
  failed: "border-neutral-300 bg-white text-neutral-500 line-through decoration-neutral-400",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`motion-surface animate-rise rounded-lg border border-neutral-200 bg-white/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.06)] sm:p-6 ${className}`}>{children}</section>;
}

export function Reader({ text, fontSize, lineHeight }: ReaderProps) {
  return <article className="whitespace-pre-wrap font-serif text-neutral-900" style={{ fontSize, lineHeight }}>{normalizeDisplayText(text)}</article>;
}

export function Mode({ modes, value, onChange }: { modes: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="inline-grid auto-cols-fr grid-flow-col rounded-lg border border-neutral-200 bg-neutral-100 p-1 text-sm font-semibold">
      {modes.map((mode) => (
        <button key={mode} type="button" onClick={() => onChange(mode)} className={`rounded-md px-3 py-1.5 capitalize transition ${value === mode ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-950"}`}>
          {mode}
        </button>
      ))}
    </div>
  );
}

export function Status({ status }: { status: string }) {
  return <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClasses[status] ?? statusClasses.untranslated}`}>{status}</span>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="animate-rise rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-6 text-center">
      <h3 className="font-serif text-xl font-semibold text-neutral-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Input({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5" placeholder={placeholder} />
    </label>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 5, className = "" }: FieldProps & { rows?: number; className?: string }) {
  return (
    <label className="mt-3 block text-sm font-medium text-neutral-700">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`mt-1.5 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 ${className}`} placeholder={placeholder} />
    </label>
  );
}

export function CustomSelect({ label, value, onChange, options, placeholder = "Select", disabled = false, className = "", buttonClassName = "" }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; placeholder?: string; disabled?: boolean; className?: string; buttonClassName?: string }) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label id={`${id}-label`} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <button
        type="button"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`mt-1.5 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm text-neutral-950 outline-none transition duration-200 hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 ${buttonClassName}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-neutral-400 transition duration-200 ${open ? "rotate-180 text-neutral-950" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 origin-top animate-select-pop rounded-lg border border-neutral-200 bg-white p-1 shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
          <div role="listbox" aria-labelledby={`${id}-label`} className="max-h-[11.75rem] overflow-y-auto overscroll-contain">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => selectValue(option.value)}
                  className={`flex w-full items-start justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition duration-150 ${active ? "bg-neutral-950 text-white" : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"} disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? <span className={`mt-0.5 block text-xs leading-5 ${active ? "text-white/70" : "text-neutral-500"}`}>{option.description}</span> : null}
                  </span>
                  {active ? <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const primaryButton = "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500";
export const secondaryButton = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-950 hover:text-neutral-950";
export const subtleButton = "rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950";

export function LoadingButton({ loading, loadingLabel, children, className = primaryButton, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button {...props} disabled={disabled || loading} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        <span>{loading ? loadingLabel ?? "Working ..." : children}</span>
      </span>
    </button>
  );
}

export function ConfirmDialog({ title, body, confirmLabel = "Confirm", open, destructive = false, onCancel, onConfirm }: { title: string; body: string; confirmLabel?: string; open: boolean; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-neutral-950/30 px-4 py-8 backdrop-blur-sm animate-page" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="animate-scale-in w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6">
        <h2 className="font-serif text-2xl font-semibold text-neutral-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
          <button type="button" onClick={onConfirm} className={destructive ? "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800" : primaryButton}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/30 px-4 py-8 backdrop-blur-sm animate-page" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-scale-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950" aria-label="Close dialog">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}