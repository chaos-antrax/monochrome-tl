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

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: FieldProps) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
        placeholder={placeholder}
      />
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  className = "",
}: FieldProps & { rows?: number; className?: string }) {
  return (
    <label className="mt-3 block text-sm font-medium text-neutral-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`mt-1.5 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2.5 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 ${className}`}
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
  className = "",
  buttonClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
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
      <label
        id={`${id}-label`}
        className="block text-sm font-medium text-neutral-700"
      >
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
        <span className="min-w-0 truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition duration-200 ${open ? "rotate-180 text-neutral-950" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 origin-top animate-select-pop rounded-lg border border-neutral-200 bg-white p-1 shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
          <div
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="max-h-[11.75rem] overflow-y-auto overscroll-contain"
          >
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
                    <span className="block truncate font-medium">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span
                        className={`mt-0.5 block text-xs leading-5 ${active ? "text-white/70" : "text-neutral-500"}`}
                      >
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
