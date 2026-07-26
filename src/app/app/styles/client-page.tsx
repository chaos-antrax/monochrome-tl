"use client";

import { FormEvent, useState } from "react";
import { MAX_STYLE_GUIDE_CHARACTERS } from "@/lib/constants";
import {
  useSettings,
  labelDate,
  type StyleGuide,
} from "../../workspace/state";
import {
  Card,
  ConfirmDialog,
  Empty,
  formatChangedFields,
  Input,
  Modal,
  Textarea,
} from "../../workspace/ui";

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export default function StylesPage() {
  const { styles, addStyle, editStyle, deleteStyle } = useSettings();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StyleGuide | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

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
      <Textarea
        label="Content"
        value={content}
        onChange={setContent}
        rows={12}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/55">
          {content.length} / {MAX_STYLE_GUIDE_CHARACTERS}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              !name.trim() ||
              !content.trim() ||
              content.length > MAX_STYLE_GUIDE_CHARACTERS
            }
            className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
          >
            Create style
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
              Style Guides
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">
              Voice library
            </h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
          >
            New style
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/55">
          Your preferred of style guides. Create a new style guide to define a
          reusable literary tone for your translations, or select an existing
          style guide to edit its content.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {styles.map((style) => (
          <Card key={style.id}>
            <h2 className="font-serif text-2xl font-semibold">{style.name}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground/60">
              {style.content}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-foreground/55">
              Updated {labelDate(style.updatedAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(style)}
                className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => requestDeleteStyle(style)}
                className="inline-flex min-h-10 items-center justify-center border border-transparent px-4 py-2 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
        {styles.length === 0 ? (
          <Empty
            title="No style guides"
            body="Create a reusable voice guide, then select it while creating or editing a novel."
            action={
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                New style
              </button>
            }
          />
        ) : null}
      </div>

      <Modal
        title="Create style guide"
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      >
        {createForm}
      </Modal>

      <Modal
        title="Edit style guide"
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submitEdit} className="space-y-4">
          <Input label="Name" value={editName} onChange={setEditName} />
          <Textarea
            label="Content"
            value={editContent}
            onChange={setEditContent}
            rows={12}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground/55">
              {editContent.length} / {MAX_STYLE_GUIDE_CHARACTERS}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !editName.trim() ||
                  !editContent.trim() ||
                  editContent.length > MAX_STYLE_GUIDE_CHARACTERS
                }
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        title={confirmAction?.title ?? "Confirm action"}
        body={confirmAction?.body ?? "Continue with this change?"}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={confirmAction?.destructive}
        open={Boolean(confirmAction)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </div>
  );
}
