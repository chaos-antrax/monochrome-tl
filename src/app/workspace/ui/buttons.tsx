import type { ButtonHTMLAttributes } from "react";

export const primaryButton =
  "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500";
export const secondaryButton =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-950 hover:text-neutral-950";
export const subtleButton =
  "rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950";

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
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <span>{loading ? (loadingLabel ?? "Working ...") : children}</span>
      </span>
    </button>
  );
}
