export function Mode({ modes, value, onChange }: { modes: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="inline-grid min-h-10 auto-cols-fr grid-flow-col border border-foreground/15 bg-foreground/[0.04] p-1 text-xs font-light">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`min-h-8 px-3 py-1.5 capitalize transition ${value === mode ? "bg-foreground text-background" : "text-foreground/55 hover:text-foreground"}`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
