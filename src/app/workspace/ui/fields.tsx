import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

const labelClass = "block text-xs font-light uppercase tracking-[0.14em] text-foreground/60";
const fieldClass =
  "mt-1.5 min-h-11 w-full border border-foreground/15 bg-background px-3 py-2.5 text-sm font-light text-foreground outline-none transition placeholder:text-foreground/35 focus:border-foreground/55 focus:ring-0 disabled:cursor-not-allowed disabled:bg-foreground/[0.04] disabled:text-foreground/35";

export function Input({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className={labelClass}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 5, className = "" }: FieldProps & { rows?: number; className?: string }) {
  return (
    <label className={`mt-3 ${labelClass}`}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${fieldClass} resize-y normal-case tracking-normal ${className}`}
        placeholder={placeholder}
      />
    </label>
  );
}

export function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
  dropdownPlacement = "down",
  className = "",
  buttonClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  dropdownPlacement?: "down" | "up";
  className?: string;
  buttonClassName?: string;
}) {
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
      <label id={`${id}-label`} className={labelClass}>
        {label}
      </label>
      <button
        type="button"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`mt-1.5 flex min-h-11 w-full items-center justify-between gap-3 border border-foreground/15 bg-background px-3 py-2.5 text-left text-sm font-light text-foreground outline-none transition duration-200 hover:border-foreground/35 focus:border-foreground/55 disabled:cursor-not-allowed disabled:bg-foreground/[0.04] disabled:text-foreground/35 ${buttonClassName}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-foreground/40 transition duration-200 ${open ? "rotate-180 text-foreground" : ""}`} />
      </button>
      {open ? (
        <div
          className={`absolute left-0 right-0 z-50 border border-foreground/15 bg-background p-1 shadow-[0_18px_55px_rgba(0,0,0,0.16)] ${
            dropdownPlacement === "up"
              ? "bottom-[calc(70%+2px)] origin-bottom animate-select-pop-up"
              : "top-[calc(100%+2px)] origin-top animate-select-pop"
          }`}
        >
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
                  className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm font-light transition duration-150 ${active ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"} disabled:cursor-not-allowed disabled:text-foreground/25 disabled:hover:bg-transparent`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className={`mt-0.5 block text-xs leading-5 ${active ? "text-background/70" : "text-foreground/50"}`}>
                        {option.description}
                      </span>
                    ) : null}
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
