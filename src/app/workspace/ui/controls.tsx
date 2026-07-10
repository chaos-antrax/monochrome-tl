export function Mode({
  modes,
  value,
  onChange,
}: {
  modes: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-grid auto-cols-fr grid-flow-col rounded-lg border border-neutral-200 bg-neutral-100 p-1 text-sm font-semibold">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-md px-3 py-1.5 capitalize transition ${value === mode ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-950"}`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
