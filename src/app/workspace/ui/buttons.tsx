import type { ButtonHTMLAttributes } from "react";

export const primaryButton =
  "inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButton =
  "inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40";
export const subtleButton =
  "inline-flex min-h-10 items-center justify-center border border-transparent px-4 py-2 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground";

export function LoadingButton({
  loading,
  loadingLabel,
  children,
  className = primaryButton,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button {...props} disabled={disabled || loading} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
          />
        ) : null}
        <span>{loading ? (loadingLabel ?? "Working ...") : children}</span>
      </span>
    </button>
  );
}
