"use client";

import Link from "next/link";
import { BookOpenText, Check, ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLibrary, useReader, type Chapter, type GlossaryStatus, type GlossaryTerm, type ReaderMode } from "../../../../../workspace/state";
import { ChapterPanel } from "../../../../../workspace/chapter-panel";
import { GlossaryCategorySchema, type GlossaryCategory } from "@/lib/schemas/translation";
import {
  Card,
  ConfirmDialog,
  CustomSelect,
  Empty,
  formatChangedFields,
  Input,
  Textarea,
  Modal,
  Mode,
} from "../../../../../workspace/ui";

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const FONT_SIZE_OPTIONS = [16, 18, 19, 20, 22, 24, 26];
const LINE_HEIGHT_OPTIONS = [1.4, 1.5, 1.65, 1.8, 1.95, 2.1];

export default function ReaderPage() {
  const { novelId, chapterId } = useParams<{
    novelId: string;
    chapterId: string;
  }>();
  const router = useRouter();
  const { getNovel, getChapter, deleteChapter, editChapter, editChapterContent, setChapterPublished, addTerm, editTerm, setTermStatus, deleteTerm } = useLibrary();
  const { translateChapter, translationProgress, revertVersion, loadChapter } = useReader();
  const novel = getNovel(novelId);
  const chapter = getChapter(novelId, chapterId);
  const [mode, setMode] = useState<ReaderMode>("translated");
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [isMetaOpen, setIsMetaOpen] = useState(false);
  const [publishingChapter, setPublishingChapter] = useState<Chapter | null>(null);
  const [publishVersion, setPublishVersion] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isContentEditing, setIsContentEditing] = useState(false);
  const [editRawText, setEditRawText] = useState("");
  const [editTranslatedText, setEditTranslatedText] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryStatus, setGlossaryStatus] = useState<GlossaryStatus>("approved");
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [sourceTerm, setSourceTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState<GlossaryCategory>("character");
  const [pinyin, setPinyin] = useState("");
  const [notes, setNotes] = useState("");
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [chapterLoadError, setChapterLoadError] = useState<{ chapterId: string; message: string } | null>(null);
  const chapterListRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    let cancelled = false;
    if (!chapter || chapter.rawText || chapterLoadError?.chapterId === chapterId) return;
    void loadChapter(novelId, chapterId).catch((error) => {
      if (!cancelled) setChapterLoadError({ chapterId, message: error instanceof Error ? error.message : "Unable to load chapter." });
    });
    return () => { cancelled = true; };
  }, [chapter, chapterId, chapterLoadError?.chapterId, loadChapter, novelId]);
  useEffect(() => {
    if (!isGlossaryOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isGlossaryOpen]);

  useEffect(() => {
    const list = chapterListRef.current;
    if (!list) return;
    const saved = window.sessionStorage.getItem(`reader-chapter-list:${novelId}`);
    if (!saved) return;
    const scrollTop = Number(saved);
    if (!Number.isFinite(scrollTop)) return;
    const frame = window.requestAnimationFrame(() => {
      list.scrollTop = scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [novelId, chapterId, novel?.chapters.length]);

  if (!novel || !chapter)
    return (
      <Empty
        title="Chapter not found"
        body="Return to the novel page and choose an existing chapter."
      />
    );

  if (!chapter.rawText && chapterLoadError?.chapterId !== chapter.id)
    return (
      <Card>
        <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded bg-neutral-200" />
        <div className="mt-8 space-y-3">
          <div className="h-4 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
        </div>
      </Card>
    );

  if (chapterLoadError?.chapterId === chapter.id)
    return <Empty title="Chapter could not be loaded" body={chapterLoadError.message} />;
  const currentNovel = novel;
  const currentChapter = chapter;
  const chapterIndex = currentNovel.chapters.findIndex(
    (item) => item.id === currentChapter.id,
  );
  const previousChapter =
    chapterIndex > 0 ? currentNovel.chapters[chapterIndex - 1] : undefined;
  const nextChapter =
    chapterIndex >= 0 && chapterIndex < currentNovel.chapters.length - 1
      ? currentNovel.chapters[chapterIndex + 1]
      : undefined;
  const chapterProgress = translationProgress?.target === "chapter" && translationProgress.novelId === currentNovel.id && translationProgress.chapterId === currentChapter.id ? translationProgress : null;
  const currentTranslation = currentChapter.translations.find((item) => item.version === currentChapter.currentVersion);
  const glossarySearchQuery = glossarySearch.trim().toLowerCase();
  const glossaryTerms = currentNovel.glossary.filter((term) => {
    const matchesSearch =
      !glossarySearchQuery ||
      [term.sourceTerm, term.translation, term.category, term.pinyin, term.notes, term.conflict]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(glossarySearchQuery));
    return term.status === glossaryStatus && matchesSearch;
  });

  function saveChapterListScroll() {
    const list = chapterListRef.current;
    if (!list) return;
    window.sessionStorage.setItem(`reader-chapter-list:${currentNovel.id}`, String(list.scrollTop));
  }

  function editMeta() {
    setEditTitle(currentChapter.title);
    setIsMetaOpen(true);
  }

  function submitMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes = [
      editTitle !== currentChapter.title ? "title" : null,
    ].filter(Boolean) as string[];
    if (changes.length === 0) {
      setConfirmAction({
        title: "No changes detected",
        body: `No editable fields changed for "${currentChapter.title}".`,
        confirmLabel: "Close",
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction({
      title: "Save chapter details?",
      body: `Update ${formatChangedFields(changes)} for "${currentChapter.title}".`,
      confirmLabel: "Save changes",
      onConfirm: () => {
        editChapter(currentNovel.id, currentChapter.id, {
          title: editTitle,
        });
        setIsMetaOpen(false);
        setConfirmAction(null);
      },
    });
  }
  function startContentEdit() {
    if (mode === "translated" && !currentTranslation) setMode("raw");
    setEditRawText(currentChapter.rawText);
    setEditTranslatedText(currentTranslation?.text ?? "");
    setIsContentEditing(true);
  }

  function cancelContentEdit() {
    setIsContentEditing(false);
    setEditRawText("");
    setEditTranslatedText("");
  }

  function saveContentEdit() {
    if (!editRawText.trim()) return;
    if (currentTranslation && !editTranslatedText.trim()) return;
    const rawChanged = editRawText !== currentChapter.rawText;
    const translationChanged = Boolean(currentTranslation) && editTranslatedText !== currentTranslation?.text;
    const changes = [
      rawChanged ? "raw Chinese text" : null,
      translationChanged ? "translated text" : null,
    ].filter(Boolean) as string[];
    if (changes.length === 0) {
      setConfirmAction({
        title: "No changes detected",
        body: `No editable content changed for "${currentChapter.title}".`,
        confirmLabel: "Close",
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction({
      title: "Save chapter content?",
      body: `Update ${formatChangedFields(changes)} for "${currentChapter.title}".`,
      confirmLabel: "Save content",
      onConfirm: () => {
        editChapterContent(currentNovel.id, currentChapter.id, {
          rawText: rawChanged ? editRawText : undefined,
          translatedText: translationChanged ? editTranslatedText : undefined,
        });
        cancelContentEdit();
        setConfirmAction(null);
      },
    });
  }
  function requestSetChapterPublished(targetChapter: Chapter, published: boolean, version?: number) {
    setConfirmAction({
      title: published ? "Publish chapter?" : "Unpublish chapter?",
      body: published
        ? `Publish "${targetChapter.title}" using translation version ${version ?? targetChapter.currentVersion}.`
        : `Remove "${targetChapter.title}" from the reader app.`,
      confirmLabel: published ? "Publish chapter" : "Unpublish chapter",
      destructive: !published,
      onConfirm: () => {
        setChapterPublished(currentNovel.id, targetChapter.id, { published, version });
        setConfirmAction(null);
      },
    });
  }

  function requestPublishChapter() {
    const versions = currentChapter.translations.filter((version) => version.text.trim());
    if (versions.length === 0) return;
    const defaultVersion = versions.some((version) => version.version === currentChapter.currentVersion)
      ? currentChapter.currentVersion
      : versions[versions.length - 1].version;
    if (versions.length > 1) {
      setPublishingChapter(currentChapter);
      setPublishVersion(String(defaultVersion));
      return;
    }
    requestSetChapterPublished(currentChapter, true, versions[0].version);
  }

  function submitPublishVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publishingChapter) return;
    const version = Number(publishVersion);
    if (!Number.isFinite(version)) return;
    setPublishingChapter(null);
    requestSetChapterPublished(publishingChapter, true, version);
  }
  function resetGlossaryForm() {
    setSourceTerm("");
    setTranslation("");
    setCategory("character");
    setPinyin("");
    setNotes("");
    setIsAddingTerm(false);
  }

  function submitGlossaryTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceTerm.trim() || !translation.trim()) return;
    addTerm(currentNovel.id, {
      sourceTerm,
      translation,
      category,
      pinyin: pinyin || undefined,
      notes: notes || undefined,
    });
    resetGlossaryForm();
    setGlossaryStatus("approved");
  }

  function openEditTerm(term: GlossaryTerm) {
    setEditingTerm(term);
    setEditTranslation(term.translation);
    setEditNotes(term.notes ?? "");
  }

  function submitGlossaryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTerm || !editTranslation.trim()) return;
    const term = editingTerm;
    const nextNotes = editNotes.trim() || undefined;
    setConfirmAction({
      title: "Save glossary term?",
      body: `Update glossary entry "${term.sourceTerm}" while staying in the reader.`,
      confirmLabel: "Save changes",
      onConfirm: () => {
        editTerm(currentNovel.id, term.id, { translation: editTranslation.trim(), notes: nextNotes });
        setEditingTerm(null);
        setConfirmAction(null);
      },
    });
  }

  function requestGlossaryStatus(term: GlossaryTerm, status: GlossaryStatus) {
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

  function requestDeleteGlossaryTerm(term: GlossaryTerm) {
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
  function requestDeleteChapter() {
    setConfirmAction({
      title: "Delete chapter?",
      body: `Delete "${currentChapter.title}" and its translation history.`,
      confirmLabel: "Delete chapter",
      destructive: true,
      onConfirm: () => {
        deleteChapter(currentNovel.id, currentChapter.id);
        setConfirmAction(null);
        router.push(`/app/novels/${currentNovel.id}`);
      },
    });
  }

  return (
    <div className="grid min-h-[calc(100vh-2rem)] min-w-0 max-w-full gap-5 overflow-x-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.05)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
        <Link
          href={`/app/novels/${currentNovel.id}`}
          className="w-fit text-sm font-semibold text-neutral-500 hover:text-neutral-950"
        >
          Back to novel
        </Link>
        <h1 className="mt-4 min-w-0 truncate font-serif text-2xl font-semibold">
          {currentNovel.title}
        </h1>
        <div ref={chapterListRef} onScroll={saveChapterListScroll} className="mt-4 flex max-h-[13rem] min-h-0 min-w-0 max-w-full flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 xl:max-h-none xl:flex-1">
          {currentNovel.chapters.map((item) => (
            <Link
              key={item.id}
              href={`/app/novels/${currentNovel.id}/chapters/${item.id}`}
              scroll={false}
              onClick={saveChapterListScroll}
              className={`block min-h-16 min-w-0 max-w-full shrink-0 overflow-hidden rounded-lg px-3 py-2 text-sm transition ${item.id === currentChapter.id ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`}
            >
              <span className="block min-w-0 max-w-full truncate font-medium">{item.title}</span>
              <span className="block truncate text-xs opacity-60">{item.status}</span>
            </Link>
          ))}
        </div>
        <div className="mt-5 border-t border-neutral-200 pt-4 xl:mt-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Reader
          </p>
          <div className="mt-3 grid gap-3">
            <CustomSelect
              label="Font size"
              value={String(fontSize)}
              onChange={(value) => setFontSize(Number(value))}
              options={FONT_SIZE_OPTIONS.map((value) => ({ value: String(value), label: `${value}px` }))}
              dropdownPlacement="up"
            />
            <CustomSelect
              label="Line height"
              value={String(lineHeight)}
              onChange={(value) => setLineHeight(Number(value))}
              options={LINE_HEIGHT_OPTIONS.map((value) => ({ value: String(value), label: value.toFixed(2) }))}
              dropdownPlacement="up"
            />
          </div>
        </div>
      </aside>

      <Card className="min-h-[calc(100vh-2rem)] min-w-0 max-w-full overflow-hidden">
        <ChapterNavigation
          novelId={currentNovel.id}
          previousChapter={previousChapter}
          nextChapter={nextChapter}
        />
        <div className="mt-5 border-t border-neutral-200 pt-5">
          <ChapterPanel
            chapter={currentChapter}
            readerMode={mode}
            fontSize={fontSize}
            lineHeight={lineHeight}
            onMode={setMode}
            onTranslate={() =>
              translateChapter(currentNovel.id, currentChapter.id, false)
            }
            onRegenerate={() =>
              translateChapter(currentNovel.id, currentChapter.id, true)
            }
            onDelete={requestDeleteChapter}
            onEdit={editMeta}
            onPublish={requestPublishChapter}
            onUnpublish={() => requestSetChapterPublished(currentChapter, false)}
            isEditingContent={isContentEditing}
            editRawText={editRawText}
            editTranslatedText={editTranslatedText}
            onEditRawText={setEditRawText}
            onEditTranslatedText={setEditTranslatedText}
            onCancelEditContent={cancelContentEdit}
            onSaveContent={saveContentEdit}
            canSaveContent={Boolean(editRawText.trim()) && (!currentTranslation || Boolean(editTranslatedText.trim()))}
            onRevert={(version) =>
              revertVersion(currentNovel.id, currentChapter.id, version)
            }
            progress={chapterProgress}
          />
        </div>
        <div className="mt-6 border-t border-neutral-200 pt-5">
          <ChapterNavigation
            novelId={currentNovel.id}
            previousChapter={previousChapter}
            nextChapter={nextChapter}
          />
        </div>
      </Card>

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setIsGlossaryOpen(true)}
          className="group flex h-12 items-center gap-3 rounded-full border border-neutral-200 bg-white/95 px-4 text-sm font-semibold text-neutral-900 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur transition hover:-translate-y-0.5 hover:border-neutral-950 hover:bg-white"
          aria-label="Open glossary"
        >
          <BookOpenText aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">Glossary</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 transition group-hover:bg-neutral-950 group-hover:text-white">{currentNovel.glossary.length}</span>
        </button>
        <button
          type="button"
          onClick={startContentEdit}
          disabled={isContentEditing}
          className="flex h-12 items-center gap-3 rounded-full border border-neutral-950 bg-neutral-950 px-4 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
          aria-label="Edit chapter content"
        >
          <Edit3 aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">Edit chapter</span>
        </button>
      </div>

      {isGlossaryOpen ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-neutral-950/25 backdrop-blur-sm animate-page" role="dialog" aria-modal="true" aria-label="Reader glossary">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close glossary" onClick={() => setIsGlossaryOpen(false)} />
          <aside className="relative flex h-full w-[min(100vw,31rem)] max-w-full flex-col border-l border-neutral-200 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.24)] animate-slide-in-right">
            <div className="border-b border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Reader glossary</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">{currentNovel.title}</h2>
                </div>
                <button type="button" onClick={() => setIsGlossaryOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950" aria-label="Close glossary">
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <Mode modes={["approved", "pending", "rejected"]} value={glossaryStatus} onChange={(value) => setGlossaryStatus(value as GlossaryStatus)} />
                <label className="relative block text-sm font-medium text-neutral-700">
                  Search
                  <Search aria-hidden="true" className="absolute left-3 top-[2.45rem] h-4 w-4 text-neutral-400" />
                  <input type="text" value={glossarySearch} onChange={(event) => setGlossarySearch(event.target.value)} placeholder="Source, translation, pinyin, notes" className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-9 py-2.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5" />
                  {glossarySearch ? <button type="button" onClick={() => setGlossarySearch("")} className="absolute right-2 top-[2.2rem] grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-950" aria-label="Clear glossary search"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
                </label>
                <button type="button" onClick={() => setIsAddingTerm((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-950">
                  <Plus aria-hidden="true" className="h-4 w-4" /> {isAddingTerm ? "Hide add form" : "Add term"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-24 sm:pb-5">
              {isAddingTerm ? (
                <form onSubmit={submitGlossaryTerm} className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="grid gap-3">
                    <Input label="Source term" value={sourceTerm} onChange={setSourceTerm} />
                    <Input label="Translation" value={translation} onChange={setTranslation} />
                    <CustomSelect label="Category" value={category} onChange={(value) => setCategory(value as GlossaryCategory)} options={GlossaryCategorySchema.options.map((option) => ({ value: option, label: option }))} />
                    <Input label="Pinyin" value={pinyin} onChange={setPinyin} />
                    <Textarea label="Notes" value={notes} onChange={setNotes} rows={3} />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={resetGlossaryForm} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">Cancel</button>
                    <button type="submit" disabled={!sourceTerm.trim() || !translation.trim()} className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Save term</button>
                  </div>
                </form>
              ) : null}
              <div className="space-y-3">
                {glossaryTerms.map((term) => {
                  const isEditing = editingTerm?.id === term.id;
                  return (
                    <div key={term.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-serif text-xl font-semibold text-neutral-950">{term.sourceTerm}</h3>
                          <p className="mt-1 break-words text-sm text-neutral-600">{term.translation}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-neutral-500">{term.category}{term.pinyin ? ` / ${term.pinyin}` : ""}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => openEditTerm(term)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950" aria-label={`Edit ${term.sourceTerm}`}><Edit3 aria-hidden="true" className="h-4 w-4" /></button>
                          <button type="button" onClick={() => requestDeleteGlossaryTerm(term)} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950" aria-label={`Delete ${term.sourceTerm}`}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                        </div>
                      </div>
                      {term.notes ? <p className="mt-3 text-sm leading-6 text-neutral-600">{term.notes}</p> : null}
                      {term.conflict ? <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">Conflict: {term.conflict}</p> : null}
                      {isEditing ? (
                        <form onSubmit={submitGlossaryEdit} className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
                          <Input label="Translation" value={editTranslation} onChange={setEditTranslation} />
                          <Textarea label="Notes" value={editNotes} onChange={setEditNotes} rows={3} />
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingTerm(null)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">Cancel</button>
                            <button type="submit" disabled={!editTranslation.trim()} className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500">Save</button>
                          </div>
                        </form>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {term.status !== "approved" ? <button type="button" onClick={() => requestGlossaryStatus(term, "approved")} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold transition hover:border-neutral-950"><Check aria-hidden="true" className="h-3.5 w-3.5" />Approve</button> : null}
                        {term.status !== "rejected" ? <button type="button" onClick={() => requestGlossaryStatus(term, "rejected")} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold transition hover:border-neutral-950">Reject</button> : null}
                      </div>
                    </div>
                  );
                })}
                {glossaryTerms.length === 0 ? <Empty title="No terms here" body="No glossary terms match the selected status and search." /> : null}
              </div>
            </div>
            <div className="border-t border-neutral-200 bg-white p-4 sm:hidden">
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="w-full rounded-lg border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Close glossary
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      <Modal
        title="Edit chapter details"
        open={isMetaOpen}
        onClose={() => setIsMetaOpen(false)}
      >
        <form onSubmit={submitMeta} className="space-y-4">
          <Input
            label="Chapter title"
            value={editTitle}
            onChange={setEditTitle}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsMetaOpen(false)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Save changes
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Publish chapter"
        open={Boolean(publishingChapter)}
        onClose={() => setPublishingChapter(null)}
        overflow="visible"
      >
        <form onSubmit={submitPublishVersion} className="space-y-4">
          <p className="text-sm leading-6 text-neutral-500">
            Choose the translation version that should be visible in the reader app.
          </p>
          <CustomSelect
            label="Published version"
            value={publishVersion}
            onChange={setPublishVersion}
            options={(publishingChapter?.translations ?? [])
              .filter((version) => version.text.trim())
              .map((version) => ({
                value: String(version.version),
                label: `Version ${version.version}${version.version === publishingChapter?.currentVersion ? " (current)" : ""}`,
                description: `${version.provider} / ${version.model}`,
              }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPublishingChapter(null)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!publishVersion}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              Continue
            </button>
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

type NavigationChapter = { id: string; title: string; order: number };

function ChapterNavigation({
  novelId,
  previousChapter,
  nextChapter,
}: {
  novelId: string;
  previousChapter?: NavigationChapter;
  nextChapter?: NavigationChapter;
}) {
  const base =
    "flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition sm:w-auto sm:max-w-[48%] sm:px-4";
  const enabled =
    "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-950";
  const disabled =
    "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300";

  return (
    <nav
      aria-label="Chapter navigation"
      className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      {previousChapter ? (
        <Link
          href={`/app/novels/${novelId}/chapters/${previousChapter.id}`}
          className={`${base} ${enabled}`}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Previous: {previousChapter.title}</span>
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>Previous</span>
        </span>
      )}
      {nextChapter ? (
        <Link
          href={`/app/novels/${novelId}/chapters/${nextChapter.id}`}
          className={`${base} ${enabled} sm:ml-auto`}
        >
          <span className="min-w-0 flex-1 truncate text-right sm:text-left">Next: {nextChapter.title}</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <span className={`${base} ${disabled} sm:ml-auto`}>
          <span>Next</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </span>
      )}
    </nav>
  );
}



















