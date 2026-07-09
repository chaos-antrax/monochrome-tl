"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { GripVertical } from "lucide-react";
import { DEFAULT_MAX_CHAPTER_CHARACTERS } from "@/lib/constants";
import { useWorkspace } from "../../../../workspace/state";
import { Card, ConfirmDialog, Empty, Input, Modal, Status, Textarea } from "../../../../workspace/ui";

export default function ChaptersPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const { getNovel, addChapter, deleteChapter, reorderChapter } = useWorkspace();
  const novel = getNovel(novelId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [volume, setVolume] = useState("Volume 1");
  const [rawText, setRawText] = useState("");
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [dragOverChapterId, setDragOverChapterId] = useState<string | null>(null);
  const [deletingChapter, setDeletingChapter] = useState<{ id: string; title: string } | null>(null);

  if (!novel) return <Empty title="Novel not found" body="Return to the library and choose an existing novel." />;

  function openAdd() {
    setIsAddOpen(true);
  }

  async function paste() {
    try { setRawText(await navigator.clipboard.readText()); } catch { return; }
  }

  function startChapterDrag(event: DragEvent<HTMLButtonElement>, chapterId: string) {
    setDraggedChapterId(chapterId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chapterId);
  }

  function dragChapterOver(event: DragEvent<HTMLDivElement>, chapterId: string) {
    if (!draggedChapterId || draggedChapterId === chapterId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverChapterId(chapterId);
  }

  function dropChapter(event: DragEvent<HTMLDivElement>, chapterId: string) {
    event.preventDefault();
    if (!novel) return;
    const sourceId = event.dataTransfer.getData("text/plain") || draggedChapterId;
    if (sourceId && sourceId !== chapterId) reorderChapter(novel.id, sourceId, chapterId);
    setDraggedChapterId(null);
    setDragOverChapterId(null);
  }

  function finishChapterDrag() {
    setDraggedChapterId(null);
    setDragOverChapterId(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rawText.trim()) return;
    if (!novel) return;
    const chapterId = addChapter(novel.id, title, volume, rawText);
    if (chapterId) {
      setTitle("");
      setRawText("");
      setIsAddOpen(false);
    }
  }

  const addChapterForm = (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">Paste source text, then open the chapter to translate it.</p>
        <button type="button" onClick={paste} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold transition hover:border-neutral-950">Paste</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Title" value={title} onChange={setTitle} />
        <Input label="Volume / arc" value={volume} onChange={setVolume} />
      </div>
      <Textarea label="Raw Chinese" value={rawText} onChange={setRawText} rows={12} className="font-serif leading-7" />
      <div className="text-sm text-neutral-500">{rawText.length.toLocaleString()} / {DEFAULT_MAX_CHAPTER_CHARACTERS.toLocaleString()} characters</div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setIsAddOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
        <button type="submit" disabled={!rawText.trim() || rawText.length > DEFAULT_MAX_CHAPTER_CHARACTERS} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Add chapter</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Chapters</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">{novel.title}</h1>
            <div className="mt-4 flex gap-2">
              <Link href={`/app/novels/${novel.id}/glossary`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold transition hover:border-neutral-950">Glossary</Link>
              <Link href="/app/library" className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100">Library</Link>
            </div>
          </div>
          <button type="button" onClick={openAdd} className="w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 sm:w-auto">Add chapter</button>
        </div>
      </header>

      <Card>
        <h2 className="font-serif text-2xl font-semibold">Chapter list</h2>
        <p className="mt-2 text-sm text-neutral-500">Drag the handle beside a chapter to change reading and export order.</p>
        <div className="mt-3 divide-y divide-neutral-100">
          {novel.chapters.map((chapter) => (
            <div key={chapter.id} onDragOver={(event) => dragChapterOver(event, chapter.id)} onDragLeave={() => setDragOverChapterId((current) => current === chapter.id ? null : current)} onDrop={(event) => dropChapter(event, chapter.id)} className={`flex flex-col gap-3 rounded-lg py-4 transition sm:flex-row sm:items-center sm:justify-between ${dragOverChapterId === chapter.id ? "bg-neutral-50 ring-1 ring-neutral-300" : ""} ${draggedChapterId === chapter.id ? "opacity-50" : ""}`}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button type="button" draggable onDragStart={(event) => startChapterDrag(event, chapter.id)} onDragEnd={finishChapterDrag} aria-label={`Drag ${chapter.title} to reorder`} title="Drag to reorder" className="grid h-10 w-10 shrink-0 cursor-grab place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-400 transition hover:border-neutral-950 hover:text-neutral-950 active:cursor-grabbing">
                  <GripVertical aria-hidden="true" className="h-4 w-4" />
                </button>
                <Link href={`/app/novels/${novel.id}/chapters/${chapter.id}`} className="min-w-0 flex-1 rounded-lg p-2 transition hover:bg-neutral-50">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{chapter.volume} / Chapter {chapter.order}</p>
                  <h3 className="mt-1 truncate font-serif text-xl font-semibold">{chapter.title}</h3>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                <Status status={chapter.status} />
                <button type="button" onClick={() => setDeletingChapter({ id: chapter.id, title: chapter.title })} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950">Delete</button>
              </div>
            </div>
          ))}
          {novel.chapters.length === 0 ? <Empty title="No chapters yet" body="Paste a chapter to begin." action={<button type="button" onClick={openAdd} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Add chapter</button>} /> : null}
        </div>
      </Card>

      <Modal title="Add chapter" open={isAddOpen} onClose={() => setIsAddOpen(false)}>{addChapterForm}</Modal>
      <ConfirmDialog title="Delete chapter?" body={`Delete "${deletingChapter?.title ?? "this chapter"}" and its translation history.`} confirmLabel="Delete chapter" destructive open={Boolean(deletingChapter)} onCancel={() => setDeletingChapter(null)} onConfirm={() => { if (!deletingChapter) return; deleteChapter(novel.id, deletingChapter.id); setDeletingChapter(null); }} />
    </div>
  );
}