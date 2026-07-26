import { Edit3, Globe2, GlobeLock, Trash } from "lucide-react";
import { Empty, Mode, Reader, Status, TranslationProgressOverlay, type TranslationProgressView } from "./ui";
import type { Chapter, ReaderMode } from "./types";

const labelDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : "Never";
const cost = (value = 0) => `$${value.toFixed(4)}`;
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40";

export function ChapterPanel({
  chapter,
  readerMode,
  fontSize,
  lineHeight,
  onMode,
  onTranslate,
  onRegenerate,
  onDelete,
  onEdit,
  onPublish,
  onUnpublish,
  onRevert,
  progress,
}: {
  chapter: Chapter;
  readerMode: ReaderMode;
  fontSize: number;
  lineHeight: number;
  onMode: (mode: ReaderMode) => void;
  onTranslate: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onRevert: (version: number) => void;
  progress?: TranslationProgressView | null;
}) {
  const translation = chapter.translations.find(
    (item) => item.version === chapter.currentVersion,
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Status status={chapter.status} />
            <span className="text-xs uppercase tracking-[0.16em] text-foreground/55">
              Current chapter
            </span>
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {chapter.title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className={`${secondaryButton} flex items-center gap-2`}
          >
            <Edit3 size={16} /> Title
          </button>
          {chapter.published ? (
            <button
              type="button"
              onClick={onUnpublish}
              className={`${secondaryButton} flex items-center gap-2`}
            >
              <GlobeLock size={16} /> Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={!translation}
              title={translation ? "Publish chapter" : "Translate this chapter before publishing."}
              className={`${secondaryButton} flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-foreground/[0.06] disabled:text-foreground/35`}
            >
              <Globe2 size={16} /> Publish
            </button>
          )}
          <button type="button" onClick={onDelete} className={secondaryButton}>
            <Trash size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="xl:hidden">
          <Mode
            modes={["raw", "translated"]}
            value={readerMode === "diff" ? "translated" : readerMode}
            onChange={(value) => onMode(value as ReaderMode)}
          />
        </div>
        <div className="hidden xl:block">
          <Mode
            modes={["raw", "translated", "diff"]}
            value={readerMode}
            onChange={(value) => onMode(value as ReaderMode)}
          />
        </div>
        <button type="button" onClick={onTranslate} className={primaryButton}>
          Translate
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
        >
          Regenerate
        </button>
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-5">
        {readerMode === "raw" ? (
          <Reader text={chapter.rawText} fontSize={fontSize} lineHeight={lineHeight} />
        ) : null}

        {readerMode === "translated" || readerMode === "diff" ? (
          <div className={`relative overflow-hidden rounded-lg ${readerMode === "diff" ? "xl:hidden" : ""}`}>
            <div className={`transition duration-300 ${progress ? "blur-[2px] opacity-45" : ""}`}>
              {translation ? (
                <Reader text={translation.text} fontSize={fontSize} lineHeight={lineHeight} />
              ) : (
                <Empty
                  title="This chapter has not been translated yet"
                  body="Run a translation to create the first version."
                  action={
                    <button type="button" onClick={onTranslate} className={primaryButton}>
                      Translate this chapter
                    </button>
                  }
                />
              )}
            </div>
            <TranslationProgressOverlay progress={progress} />
          </div>
        ) : null}

        {readerMode === "diff" ? (
          <div className="hidden gap-4 xl:grid xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-foreground/55">
                Raw
              </p>
              <Reader text={chapter.rawText} fontSize={fontSize - 1} lineHeight={lineHeight} />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-foreground/55">
                Translated
              </p>
              {translation ? (
                <Reader text={translation.text} fontSize={fontSize - 1} lineHeight={lineHeight} />
              ) : (
                <Empty title="No translation" body="Translate first to compare side by side." />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {chapter.translations.length ? (
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground/55">
            Versions
          </h3>
          <div className="mt-3 space-y-2">
            {chapter.translations.map((version) => (
              <button
                key={version.version}
                type="button"
                onClick={() => onRevert(version.version)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition ${version.version === chapter.currentVersion ? "border-foreground bg-foreground/[0.045]" : "border-foreground/10 bg-[var(--surface)] hover:border-foreground/25 hover:bg-foreground/[0.035]"}`}
              >
                Version {version.version} / {version.provider} / {version.model}{" "}
                / {cost(version.estimatedCost)} / {labelDate(version.createdAt)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}