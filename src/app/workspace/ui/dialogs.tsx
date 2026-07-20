import type { ReactNode } from "react";
import { X } from "lucide-react";
import { primaryButton, secondaryButton } from "./buttons";

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  open,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  open: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-neutral-950/30 px-4 py-8 backdrop-blur-sm animate-page"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="animate-scale-in w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6">
        <h2 className="font-serif text-2xl font-semibold text-neutral-950">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                : primaryButton
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  overflow = "auto",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  overflow?: "auto" | "visible";
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/30 px-4 py-8 backdrop-blur-sm animate-page"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`animate-scale-in max-h-[90vh] w-full max-w-2xl rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6 ${overflow === "visible" ? "overflow-visible" : "overflow-y-auto"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            aria-label="Close dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
