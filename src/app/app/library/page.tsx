"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useWorkspace } from "../../workspace/state";
import { Card, ConfirmDialog, Empty, Input, Modal, Status, Textarea } from "../../workspace/ui";

function StyleSelect({ label, value, onChange, styles }: { label: string; value: string; onChange: (value: string) => void; styles: { id: string; name: string }[] }) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-neutral-950 outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5">
        <option value="">Plain</option>
        {styles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
      </select>
    </label>
  );
}

export default function LibraryPage() {
  const { novels, styles, addNovel, deleteNovel, getStyle } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [styleGuideId, setStyleGuideId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingNovelId, setDeletingNovelId] = useState<string | null>(null);
  const deletingNovel = novels.find((novel) => novel.id === deletingNovelId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    addNovel(title, description, styleGuideId || undefined);
    setTitle("");
    setDescription("");
    setStyleGuideId("");
    setIsCreateOpen(false);
  }

  function openCreate() {
    setTitle("");
    setDescription("");
    setStyleGuideId("");
    setIsCreateOpen(true);
  }

  function confirmDeleteNovel() {
    if (!deletingNovelId) return;
    deleteNovel(deletingNovelId);
    setDeletingNovelId(null);
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Library</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">Novels</h1>
          </div>
          <button type="button" onClick={openCreate} className="rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800">New novel</button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {novels.map((novel) => (
          <Card key={novel.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold">{novel.title}</h2>
                <p className="mt-1 text-sm text-neutral-500">{novel.chapters.length} chapters / {novel.glossary.filter((term) => term.status === "pending").length} pending terms</p>
              </div>
              <Status status={novel.chapters.length === 0 ? "untranslated" : novel.chapters.some((chapter) => chapter.status === "failed") ? "failed" : novel.chapters.every((chapter) => chapter.status === "translated") ? "translated" : "untranslated"} />
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-600">{(novel.descriptionTranslated ?? novel.description) || "No description yet."}</p>
            {novel.descriptionTranslated ? <p className="mt-2 line-clamp-2 font-serif text-sm leading-6 text-neutral-500">Chinese: {novel.description || "No source description."}</p> : null}
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-neutral-500">Style: {getStyle(novel)?.name ?? "Plain"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/app/novels/${novel.id}`} className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">View</Link>
              <button type="button" onClick={() => setDeletingNovelId(novel.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950">Delete</button>
            </div>
          </Card>
        ))}
        {novels.length === 0 ? <Empty title="No novels" body="Create your first novel to begin translating." action={<button type="button" onClick={openCreate} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">New novel</button>} /> : null}
      </div>

      <Modal title="Create novel" open={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Title" value={title} onChange={setTitle} />
          <StyleSelect label="Writing style" value={styleGuideId} onChange={setStyleGuideId} styles={styles} />
          <Textarea label="Raw Chinese description" value={description} onChange={setDescription} rows={6} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Create novel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog title="Delete novel?" body={`Delete "${deletingNovel?.title ?? "this novel"}" and all of its chapters, glossary terms, and saved translations.`} confirmLabel="Delete novel" destructive open={Boolean(deletingNovelId)} onCancel={() => setDeletingNovelId(null)} onConfirm={confirmDeleteNovel} />
    </div>
  );
}