import { Empty, Mode, Reader, Status } from "./ui";
import type { Provider } from "@/lib/schemas/translation";

type ReaderMode = "raw" | "translated" | "diff";
type Tokens = { input: number; output: number };

type TranslationVersion = {
  version: number;
  text: string;
  model: string;
  provider: Provider;
  tokensUsed: Tokens;
  estimatedCost: number;
  createdAt: string;
  rawTextHash: string;
};

type Chapter = {
  id: string;
  title: string;
  volume: string;
  order: number;
  rawText: string;
  rawTextHash: string;
  status: "untranslated" | "queued" | "translating" | "translated" | "failed";
  translations: TranslationVersion[];
  currentVersion: number;
  error?: string;
};

const labelDate = (value?: string) => (value ? new Date(value).toLocaleString() : "Never");
const cost = (value = 0) => `$${value.toFixed(4)}`;
const secondaryButton = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950";
const primaryButton = "rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800";

export function ChapterPanel({ chapter, readerMode, fontSize, lineHeight, onMode, onTranslate, onRegenerate, onDelete, onEdit, onEditRaw, onRevert }: { chapter: Chapter; readerMode: ReaderMode; fontSize: number; lineHeight: number; onMode: (mode: ReaderMode) => void; onTranslate: () => void; onRegenerate: () => void; onDelete: () => void; onEdit: () => void; onEditRaw: () => void; onRevert: (version: number) => void }) {
  const translation = chapter.translations.find((item) => item.version === chapter.currentVersion);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Status status={chapter.status} /><span className="text-xs uppercase tracking-[0.16em] text-neutral-500">Current chapter</span></div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">{chapter.title}</h2>
          {chapter.error ? <p className="mt-2 text-sm text-neutral-600">Last error: {chapter.error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">

          <button type="button" onClick={onEdit} className={secondaryButton}>Edit</button>
          <button type="button" onClick={onEditRaw} className={secondaryButton}>Edit raw</button>
          <button type="button" onClick={onDelete} className={secondaryButton}>Delete</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Mode modes={["raw", "translated", "diff"]} value={readerMode} onChange={(value) => onMode(value as ReaderMode)} />
        <button type="button" onClick={onTranslate} className={primaryButton}>Translate</button>
        <button type="button" onClick={onRegenerate} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-950 hover:text-neutral-950">Regenerate</button>
      </div>

      <div className="mt-5 border-t border-neutral-200 pt-5">
        {readerMode === "raw" ? <Reader text={chapter.rawText} fontSize={fontSize} lineHeight={lineHeight} /> : null}
        {readerMode === "translated" ? translation ? <Reader text={translation.text} fontSize={fontSize} lineHeight={lineHeight} /> : <Empty title="This chapter has not been translated yet" body="Run a translation to create the first version." action={<button type="button" onClick={onTranslate} className={primaryButton}>Translate this chapter</button>} /> : null}
        {readerMode === "diff" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="mb-2 text-xs uppercase tracking-[0.16em] text-neutral-500">Raw</p><Reader text={chapter.rawText} fontSize={fontSize - 1} lineHeight={lineHeight} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.16em] text-neutral-500">Translated</p>{translation ? <Reader text={translation.text} fontSize={fontSize - 1} lineHeight={lineHeight} /> : <Empty title="No translation" body="Translate first to compare side by side." />}</div>
          </div>
        ) : null}
      </div>

      {chapter.translations.length ? (
        <div className="mt-5 border-t border-neutral-200 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">Versions</h3>
          <div className="mt-3 space-y-2">
            {chapter.translations.map((version) => (
              <button key={version.version} type="button" onClick={() => onRevert(version.version)} className={`w-full rounded-lg border p-3 text-left text-sm transition ${version.version === chapter.currentVersion ? "border-neutral-950 bg-neutral-50 shadow-sm" : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"}`}>
                Version {version.version} / {version.provider} / {version.model} / {cost(version.estimatedCost)} / {labelDate(version.createdAt)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}