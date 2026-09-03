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
      className="fixed inset-0 z-110 grid place-items-center bg-background/40 px-4 py-8 backdrop-blur-xl animate-page"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="animate-scale-in w-full max-w-md border border-foreground/15 bg-background p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6">
        <h2 className="font-serif text-2xl font-light text-foreground">
          {title}
        </h2>
        <p className="mt-3 text-sm font-light leading-6 text-foreground/60">
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "border border-foreground bg-foreground px-3 py-2 text-xs font-light text-background transition hover:bg-foreground/90"
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
      className="fixed inset-0 z-100 grid place-items-center bg-background/40 px-4 py-8 backdrop-blur-xl animate-page"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`animate-scale-in max-h-[90vh] w-full max-w-2xl border border-foreground/15 bg-background p-5 shadow-[0_32px_100px_rgba(0,0,0,0.22)] sm:p-6 ${overflow === "visible" ? "overflow-visible" : "overflow-y-auto"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 pb-4">
          <h2 className="font-serif text-2xl font-light text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center text-foreground/55 transition hover:bg-foreground/[0.06] hover:text-foreground"
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
