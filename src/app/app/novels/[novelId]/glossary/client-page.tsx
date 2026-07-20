"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { GlossaryCategorySchema, type GlossaryCategory } from "@/lib/schemas/translation";
import { useLibrary, type GlossaryStatus, type GlossaryTerm } from "../../../../workspace/state";
import { Card, ConfirmDialog, CustomSelect, Empty, formatChangedFields, Input, Modal, Mode, Textarea } from "../../../../workspace/ui";

type ConfirmAction = { title: string; body: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void };

export default function GlossaryPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const { getNovel, addTerm, editTerm, setTermStatus, deleteTerm } = useLibrary();
  const novel = getNovel(novelId);
  const [tab, setTab] = useState<GlossaryStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState<"all" | GlossaryCategory>("all");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [sourceTerm, setSourceTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState<GlossaryCategory>("character");
  const [pinyin, setPinyin] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<GlossaryTerm | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  if (!novel) return <Empty title="Novel not found" body="Return to the library and choose an existing novel." />;
  const currentNovel = novel;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceTerm.trim() || !translation.trim() || !novel) return;
    addTerm(currentNovel.id, { sourceTerm, translation, category, pinyin: pinyin || undefined, notes: notes || undefined });
    setSourceTerm("");
    setTranslation("");
    setPinyin("");
    setNotes("");
    setIsAddOpen(false);
  }

  function openEdit(term: GlossaryTerm) {
    setEditing(term);
    setEditTranslation(term.translation);
    setEditNotes(term.notes ?? "");
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novel || !editing || !editTranslation.trim()) return;
    const term = editing;
    const nextNotes = editNotes.trim() || undefined;
    const changes = [
      editTranslation.trim() !== term.translation ? "translation" : null,
      nextNotes !== term.notes ? "notes" : null,
    ].filter(Boolean) as string[];
    if (changes.length === 0) {
      setConfirmAction({
        title: "No changes detected",
        body: `No editable fields changed for "${term.sourceTerm}".`,
        confirmLabel: "Close",
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction({
      title: "Save glossary term?",
      body: `Update ${formatChangedFields(changes)} for "${term.sourceTerm}".`,
      confirmLabel: "Save changes",
      onConfirm: () => {
        editTerm(currentNovel.id, term.id, { translation: editTranslation.trim(), notes: nextNotes });
        setEditing(null);
        setConfirmAction(null);
      },
    });
  }

  function requestTermStatus(term: GlossaryTerm, status: GlossaryStatus) {
    setConfirmAction({
      title: `${status === "approved" ? "Approve" : "Reject"} term?`,
      body: `Mark "${term.sourceTerm}" as ${status}.`,
      confirmLabel: status === "approved" ? "Approve" : "Reject",
      onConfirm: () => {
        setTermStatus(currentNovel.id, term.id, status);
        setConfirmAction(null);
      },
    });
  }

  function requestDeleteTerm(term: GlossaryTerm) {
    setConfirmAction({
      title: "Delete glossary term?",
      body: `Delete the glossary entry for "${term.sourceTerm}".`,
      confirmLabel: "Delete term",
      destructive: true,
      onConfirm: () => {
        deleteTerm(currentNovel.id, term.id);
        setConfirmAction(null);
      },
    });
  }

  const glossarySearchQuery = glossarySearch.trim().toLowerCase();
  const terms = currentNovel.glossary.filter((term) => {
    const matchesSearch =
      !glossarySearchQuery ||
      [term.sourceTerm, term.translation, term.category, term.pinyin, term.notes, term.conflict]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(glossarySearchQuery));
    return term.status === tab && (categoryFilter === "all" || term.category === categoryFilter) && matchesSearch;
  });
  const addTermForm = (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Source term" value={sourceTerm} onChange={setSourceTerm} />
      <Input label="Translation" value={translation} onChange={setTranslation} />
      <CustomSelect label="Category" value={category} onChange={(value) => setCategory(value as GlossaryCategory)} options={GlossaryCategorySchema.options.map((option) => ({ value: option, label: option }))} />
      <Input label="Pinyin" value={pinyin} onChange={setPinyin} />
      <Textarea label="Notes" value={notes} onChange={setNotes} rows={4} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setIsAddOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
        <button type="submit" disabled={!sourceTerm.trim() || !translation.trim()} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Save term</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Glossary</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">{currentNovel.title}</h1>
            <div className="mt-4 flex gap-2"><Link href={`/app/novels/${currentNovel.id}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold transition hover:border-neutral-950">Novel</Link></div>
          </div>
          <button type="button" onClick={() => setIsAddOpen(true)} className="w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 sm:w-auto">Add term</button>
        </div>
      </header>

      <Card>
        <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-2xl font-semibold">Terms</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Mode modes={["approved", "pending", "rejected"]} value={tab} onChange={(value) => setTab(value as GlossaryStatus)} />
            <CustomSelect label="Category" value={categoryFilter} onChange={(value) => setCategoryFilter(value as "all" | GlossaryCategory)} className="min-w-44" options={[{ value: "all", label: "All categories" }, ...GlossaryCategorySchema.options.map((option) => ({ value: option, label: option }))]} />
            <label className="relative block min-w-0 flex-1 text-sm font-medium text-neutral-700 sm:min-w-64">
              Search
              <Search aria-hidden="true" className="absolute left-3 top-[2.45rem] h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={glossarySearch}
                onChange={(event) => setGlossarySearch(event.target.value)}
                placeholder="Source, translation, pinyin, notes"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-9 py-2.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
              />
              {glossarySearch ? (
                <button
                  type="button"
                  onClick={() => setGlossarySearch("")}
                  className="absolute right-2 top-[2.2rem] grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label="Clear glossary search"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {terms.map((term) => (
            <div key={term.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-semibold">{term.sourceTerm} <span className="font-sans text-base font-normal text-neutral-500">-&gt; {term.translation}</span></h3>
                  <p className="mt-1 text-sm text-neutral-500">{term.category}{term.pinyin ? ` / ${term.pinyin}` : ""}</p>
                  {term.notes ? <p className="mt-2 text-sm leading-6 text-neutral-600">{term.notes}</p> : null}
                  {term.conflict ? <p className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm">Conflict: {term.conflict}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(term)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950">Edit</button>
                  {term.status !== "approved" ? <button type="button" onClick={() => requestTermStatus(term, "approved")} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950">Approve</button> : null}
                  {term.status !== "rejected" ? <button type="button" onClick={() => requestTermStatus(term, "rejected")} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950">Reject</button> : null}
                  <button type="button" onClick={() => requestDeleteTerm(term)} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {terms.length === 0 ? <Empty title="No terms here" body="No glossary terms match the selected status, category, and search." action={<button type="button" onClick={() => setIsAddOpen(true)} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Add term</button>} /> : null}
        </div>
      </Card>

      <Modal title="Add glossary term" open={isAddOpen} onClose={() => setIsAddOpen(false)}>{addTermForm}</Modal>

      <Modal title="Edit glossary term" open={Boolean(editing)} onClose={() => setEditing(null)}>
        <form onSubmit={submitEdit} className="space-y-4">
          <div className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">Source term: <span className="font-serif text-lg font-semibold text-neutral-950">{editing?.sourceTerm}</span></div>
          <Input label="Translation" value={editTranslation} onChange={setEditTranslation} />
          <Textarea label="Notes" value={editNotes} onChange={setEditNotes} rows={5} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950">Cancel</button>
            <button type="submit" disabled={!editTranslation.trim()} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Save changes</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog title={confirmAction?.title ?? "Confirm action"} body={confirmAction?.body ?? "Continue with this change?"} confirmLabel={confirmAction?.confirmLabel} destructive={confirmAction?.destructive} open={Boolean(confirmAction)} onCancel={() => setConfirmAction(null)} onConfirm={() => confirmAction?.onConfirm()} />
    </div>
  );
}