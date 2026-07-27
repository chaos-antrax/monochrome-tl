"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLibrary, useSettings } from "../../workspace/state";
import {
  Badge,
  Card,
  ConfirmDialog,
  CustomSelect,
  Empty,
  Input,
  Modal,
  Status,
  Textarea,
} from "../../workspace/ui";

function StyleSelect({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  styles: { id: string; name: string }[];
}) {
  return (
    <CustomSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[{ value: "", label: "Plain" }, ...styles.map((style) => ({ value: style.id, label: style.name }))]}
    />
  );
}

export default function LibraryPage() {
  const { novels, addNovel, deleteNovel } = useLibrary();
  const { styles, getStyle } = useSettings();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionTranslated, setDescriptionTranslated] = useState("");
  const [styleGuideId, setStyleGuideId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingNovelId, setDeletingNovelId] = useState<string | null>(null);
  const deletingNovel = novels.find((novel) => novel.id === deletingNovelId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    addNovel(title, description, styleGuideId || undefined, descriptionTranslated);
    setTitle("");
    setDescription("");
    setDescriptionTranslated("");
    setStyleGuideId("");
    setIsCreateOpen(false);
  }

  function openCreate() {
    setTitle("");
    setDescription("");
    setDescriptionTranslated("");
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
      <header className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
              Library
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">Novels</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
          >
            New novel
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/55">
          Your collection of novels. Click &quot;New novel&quot; to create a new project,
          or select an existing novel to view its chapters, glossary terms, and
          translations.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {novels.map((novel) => (
          <Card key={novel.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  {novel.title}
                </h2>
                <p className="mt-1 text-sm text-foreground/55">
                  {novel.chapters.length} chapters / {novel.chapters.filter((chapter) => chapter.published).length} published /{" "}
                  {
                    novel.glossary.filter((term) => term.status === "pending")
                      .length
                  }{" "}
                  pending terms
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge active={Boolean(novel.published)}>{novel.published ? "Published" : "Draft"}</Badge>
                <Status
                  status={
                    novel.chapters.length === 0
                      ? "untranslated"
                      : novel.chapters.some(
                            (chapter) => chapter.status === "failed",
                          )
                        ? "failed"
                        : novel.chapters.every(
                              (chapter) => chapter.status === "translated",
                            )
                          ? "translated"
                          : "untranslated"
                  }
                />
              </div>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-foreground/60">
              {(novel.descriptionTranslated ?? novel.description) ||
                "No description yet."}
            </p>
            {novel.descriptionTranslated ? (
              <p className="mt-2 line-clamp-2 font-serif text-sm leading-6 text-foreground/55">
                Chinese: {novel.description || "No source description."}
              </p>
            ) : null}
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-foreground/55">
              Style: {getStyle(novel)?.name ?? "Plain"}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/app/novels/${novel.id}`}
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                View
              </Link>
              <button
                type="button"
                onClick={() => setDeletingNovelId(novel.id)}
                className="inline-flex min-h-10 items-center justify-center border border-transparent px-4 py-2 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
        {novels.length === 0 ? (
          <Empty
            title="No novels"
            body="Create your first novel to begin translating."
            action={
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                New novel
              </button>
            }
          />
        ) : null}
      </div>

      <Modal
        title="Create novel"
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          <Input label="Title" value={title} onChange={setTitle} />
          <StyleSelect
            label="Writing style"
            value={styleGuideId}
            onChange={setStyleGuideId}
            styles={styles}
          />
          <Textarea
            label="Raw Chinese description"
            value={description}
            onChange={setDescription}
            rows={6}
          />
          <Textarea
            label="English description"
            value={descriptionTranslated}
            onChange={setDescriptionTranslated}
            rows={6}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
            >
              Create novel
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        title="Delete novel?"
        body={`Delete "${deletingNovel?.title ?? "this novel"}" and all of its chapters, glossary terms, and saved translations.`}
        confirmLabel="Delete novel"
        destructive
        open={Boolean(deletingNovelId)}
        onCancel={() => setDeletingNovelId(null)}
        onConfirm={confirmDeleteNovel}
      />
    </div>
  );
}
