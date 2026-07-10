"use client";

import { useState } from "react";
import { Download, FileArchive, FileText, Printer, type LucideIcon } from "lucide-react";
import { useWorkspace, type ExportFormat } from "../../workspace/state";
import { Card, CustomSelect, Empty } from "../../workspace/ui";

const exportOptions: Array<{ format: ExportFormat; label: string; description: string; Icon: LucideIcon }> = [
  { format: "txt", label: "TXT", description: "Plain text manuscript for lightweight editing and backups.", Icon: FileText },
  { format: "html", label: "HTML", description: "Styled browser-readable manuscript with chapter sections.", Icon: Download },
  { format: "epub", label: "EPUB", description: "E-reader package with contents, metadata, and chapter files.", Icon: FileArchive },
];

export default function ExportPage() {
  const { novels, exportNovel, printNovel } = useWorkspace();
  const [novelId, setNovelId] = useState(novels[0]?.id ?? "");
  const selectedNovel = novels.find((novel) => novel.id === novelId) ?? novels[0] ?? null;

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Export</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold">Download manuscript</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">Choose a novel and export the current translated version of each chapter. Untranslated chapters are marked clearly in the output.</p>
      </header>

      <Card>
        {novels.length === 0 ? (
          <Empty title="No novels" body="Create a novel before exporting a manuscript." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {novels.length === 1 ? (
                <label className="block text-sm font-medium text-neutral-700">Novel<input value={selectedNovel?.title ?? ""} disabled className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2.5 text-neutral-500" /></label>
              ) : (
                <CustomSelect label="Novel" value={selectedNovel?.id ?? ""} onChange={setNovelId} options={novels.map((novel) => ({ value: novel.id, label: novel.title }))} />
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {exportOptions.map(({ format, label, description, Icon }) => (
                  <button key={format} type="button" disabled={!selectedNovel} onClick={() => selectedNovel ? exportNovel(selectedNovel.id, format) : undefined} className="group rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-950 hover:shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400">
                    <Icon aria-hidden="true" className="h-5 w-5 text-neutral-500 transition group-hover:text-neutral-950" />
                    <span className="mt-4 block font-serif text-2xl font-semibold">{label}</span>
                    <span className="mt-2 block text-sm leading-6 text-neutral-500">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Selected</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">{selectedNovel?.title ?? "No novel"}</h2>
              <div className="mt-4 grid gap-2 text-sm text-neutral-600">
                <div className="flex justify-between gap-4"><span>Chapters</span><span>{selectedNovel?.chapters.length ?? 0}</span></div>
                <div className="flex justify-between gap-4"><span>Translated</span><span>{selectedNovel?.chapters.filter((chapter) => chapter.status === "translated").length ?? 0}</span></div>
                <div className="flex justify-between gap-4"><span>Glossary terms</span><span>{selectedNovel?.glossary.length ?? 0}</span></div>
              </div>
              <button type="button" disabled={!selectedNovel} onClick={() => selectedNovel ? printNovel(selectedNovel.id) : undefined} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400">
                <Printer aria-hidden="true" className="h-4 w-4" />
                Print / PDF
              </button>
            </aside>
          </div>
        )}
      </Card>
    </div>
  );
}