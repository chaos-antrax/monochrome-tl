"use client";

import { FormEvent, useState } from "react";
import { MAX_STYLE_GUIDE_CHARACTERS } from "@/lib/constants";
import { useWorkspace, labelDate, type StyleGuide } from "../../workspace/state";
import { Card, ConfirmDialog, Empty, formatChangedFields, Input, Modal, Textarea } from "../../workspace/ui";

type ConfirmAction = { title: string; body: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void };

export default function StylesPage() {
  const { styles, addStyle, editStyle, deleteStyle } = useWorkspace();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StyleGuide | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addStyle(name, content);
    setName("");
    setContent("");
    setIsCreateOpen(false);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const style = editing;
    const changes = [
      editName !== style.name ? "name" : null,
      editContent !== style.content ? "content" : null,
    ].filter(Boolean) as string[];
    if (changes.length === 0) {
      setConfirmAction({
        title: "No changes detected",
        body: `No editable fields changed for "${style.name}".`,
        confirmLabel: "Close",
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction({
      title: "Save style changes?",
      body: `Update ${formatChangedFields(changes)} for "${style.name}".`,
      confirmLabel: "Save changes",
      onConfirm: () => {
        editStyle(style.id, editName, editContent);
        setEditing(null);
        setConfirmAction(null);
      },
    });
  }

  function openCreate() {
    setName("");
    setContent("");
    setIsCreateOpen(true);
  }

  function openEdit(style: StyleGuide) {
    setEditing(style);
    setEditName(style.name);
    setEditContent(style.content);
  }

  function requestDeleteStyle(style: StyleGuide) {
    setConfirmAction({
      title: "Delete style guide?",
      body: `Delete "${style.name}". Novels using it will fall back to Plain.`,
      confirmLabel: "Delete style",
      destructive: true,
      onConfirm: () => {
        deleteStyle(style.id);
        setConfirmAction(null);
      },
    });
  }

  const createForm = (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Name" value={name} onChange={setName} />
      <Textarea label="Content" value={content} onChange={setContent} rows={12} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">{content.length} / {MAX_STYLE_GUIDE_CHARACTERS}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
          <button type="submit" disabled={!name.trim() || !content.trim() || content.length > MAX_STYLE_GUIDE_CHARACTERS} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Create style</button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Style Guides</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">Voice library</h1>
          </div>
          <button type="button" onClick={openCreate} className="rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800">New style</button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {styles.map((style) => (
          <Card key={style.id}>
            <h2 className="font-serif text-2xl font-semibold">{style.name}</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{style.content}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-neutral-500">Updated {labelDate(style.updatedAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => openEdit(style)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950">Edit</button>
              <button type="button" onClick={() => requestDeleteStyle(style)} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950">Delete</button>
            </div>
          </Card>
        ))}
        {styles.length === 0 ? <Empty title="No style guides" body="Create a reusable voice guide, then select it while creating or editing a novel." action={<button type="button" onClick={openCreate} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">New style</button>} /> : null}
      </div>

      <Modal title="Create style guide" open={isCreateOpen} onClose={() => setIsCreateOpen(false)}>{createForm}</Modal>

      <Modal title="Edit style guide" open={Boolean(editing)} onClose={() => setEditing(null)}>
        <form onSubmit={submitEdit} className="space-y-4">
          <Input label="Name" value={editName} onChange={setEditName} />
          <Textarea label="Content" value={editContent} onChange={setEditContent} rows={12} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500">{editContent.length} / {MAX_STYLE_GUIDE_CHARACTERS}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
              <button type="submit" disabled={!editName.trim() || !editContent.trim() || editContent.length > MAX_STYLE_GUIDE_CHARACTERS} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Save changes</button>
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmDialog title={confirmAction?.title ?? "Confirm action"} body={confirmAction?.body ?? "Continue with this change?"} confirmLabel={confirmAction?.confirmLabel} destructive={confirmAction?.destructive} open={Boolean(confirmAction)} onCancel={() => setConfirmAction(null)} onConfirm={() => confirmAction?.onConfirm()} />
    </div>
  );
}