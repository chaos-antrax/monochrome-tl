"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Clipboard, Edit2, Globe2, GlobeLock, GripVertical, LoaderCircle, Search, Trash2, Upload, X } from "lucide-react";
import { DEFAULT_MAX_CHAPTER_CHARACTERS } from "@/lib/constants";
import {
  GlossaryCategorySchema,
  type GlossaryCategory,
} from "@/lib/schemas/translation";
import {
  useAuth,
  useToast,
  useLibrary,
  useReader,
  useSettings,
  type Chapter,
  type GlossaryStatus,
  type GlossaryTerm,
} from "../../../workspace/state";
import {
  Badge,
  Card,
  ConfirmDialog,
  CustomSelect,
  Empty,
  formatChangedFields,
  Input,
  Modal,
  Mode,
  normalizeDisplayText,
  Status,
  Textarea,
  TranslationProgressOverlay,
} from "../../../workspace/ui";

type MainTab = "chapters" | "glossary";
type DescriptionMode = "english" | "chinese";
type ChapterSortOrder = "asc" | "desc";
type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

function versionHasText(version: Chapter["translations"][number]) {
  return Boolean(version.hasText || version.text.trim());
}

const GLOSSARY_SAMPLE_JSON = JSON.stringify(
  [
    {
      sourceTerm: "Chinese source term",
      translation: "Mo Hua",
      category: "character",
      pinyin: "Mo Hua",
      notes: "Protagonist.",
      status: "approved",
    },
    {
      sourceTerm: "Chinese source term 2",
      translation: "Dao Stele",
      category: "item",
      notes: "Important cultivation artifact.",
    },
  ],
  null,
  2,
);

function parseGlossaryUploadJson(input: string): Array<Omit<GlossaryTerm, "id">> {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Glossary JSON must be an array of term objects.");
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Glossary item ${index + 1} must be an object.`);
    const item = entry as Record<string, unknown>;
    const sourceTerm = typeof item.sourceTerm === "string" ? item.sourceTerm.trim() : "";
    const translation = typeof item.translation === "string" ? item.translation.trim() : "";
    const categoryResult = GlossaryCategorySchema.safeParse(item.category);
    const status = item.status === "pending" || item.status === "rejected" || item.status === "approved" ? item.status : "approved";
    if (!sourceTerm || !translation) throw new Error(`Glossary item ${index + 1} needs sourceTerm and translation.`);
    if (!categoryResult.success) throw new Error(`Glossary item ${index + 1} has an invalid category.`);
    return {
      sourceTerm,
      translation,
      category: categoryResult.data,
      pinyin: typeof item.pinyin === "string" && item.pinyin.trim() ? item.pinyin.trim() : undefined,
      notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : undefined,
      status,
    };
  });
}

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
      options={[
        { value: "", label: "Plain" },
        ...styles.map((style) => ({ value: style.id, label: style.name })),
      ]}
    />
  );
}

export default function NovelPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const router = useRouter();
  const { account } = useAuth();
  const { jobs, getNovel, editNovel, deleteNovel, setNovelPublished, addChapter, deleteChapter, reorderChapter, setChapterPublished, addTerm, importTerms, editTerm, setTermStatus, deleteTerm, loadNovel } = useLibrary();
  const { translationProgress, translateDescription } = useReader();
  const { styles, getStyle } = useSettings();
  const { setMessage } = useToast();
  const novel = getNovel(novelId);
  useEffect(() => {
    if (!novel || novel.isFull) return;
    void loadNovel(novel.id);
  }, [loadNovel, novel]);
  const [mainTab, setMainTab] = useState<MainTab>("chapters");
  const [chapterSortOrder, setChapterSortOrder] = useState<ChapterSortOrder>("desc");
  const [isChapterSortAnimating, setIsChapterSortAnimating] = useState(false);
  const chapterSortAnimationTimerRef = useRef<number | null>(null);
  const glossaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [descriptionMode, setDescriptionMode] =
    useState<DescriptionMode>("english");
  const [isEditNovelOpen, setIsEditNovelOpen] = useState(false);
  const [editNovelTitle, setEditNovelTitle] = useState("");
  const [editNovelDescription, setEditNovelDescription] = useState("");
  const [editNovelTranslatedDescription, setEditNovelTranslatedDescription] =
    useState("");
  const [editNovelStyleGuideId, setEditNovelStyleGuideId] = useState("");
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [publishingChapter, setPublishingChapter] = useState<Chapter | null>(null);
  const [publishVersion, setPublishVersion] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [translatedChapterText, setTranslatedChapterText] = useState("");
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [dragOverChapterId, setDragOverChapterId] = useState<string | null>(
    null,
  );
  const [glossaryTab, setGlossaryTab] = useState<GlossaryStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | GlossaryCategory
  >("all");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [sourceTerm, setSourceTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState<GlossaryCategory>("character");
  const [pinyin, setPinyin] = useState("");
  const [notes, setNotes] = useState("");
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  if (!novel)
    return (
      <Empty
        title="Novel not found"
        body="Return to the library and choose an existing novel."
      />
    );
  const currentNovel = novel;

  const hasTranslation = Boolean(currentNovel.descriptionTranslated?.trim());
  const effectiveMode = hasTranslation ? descriptionMode : "chinese";
  const descriptionText =
    effectiveMode === "english"
      ? currentNovel.descriptionTranslated?.trim()
      : currentNovel.description.trim();
  const sortedChapters = [...currentNovel.chapters].sort((a, b) =>
    chapterSortOrder === "asc" ? a.order - b.order : b.order - a.order,
  );
  const glossarySearchQuery = glossarySearch.trim().toLowerCase();
  const terms = currentNovel.glossary.filter((term) => {
    const matchesSearch =
      !glossarySearchQuery ||
      [term.sourceTerm, term.translation, term.category, term.pinyin, term.notes, term.conflict]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(glossarySearchQuery));
    return term.status === glossaryTab && (categoryFilter === "all" || term.category === categoryFilter) && matchesSearch;
  });
  const isDescriptionTranslating = jobs.some(
    (job) =>
      job.novelId === currentNovel.id &&
      job.target === "description" &&
      (job.status === "queued" || job.status === "processing"),
  );
  const descriptionButtonLabel = isDescriptionTranslating
    ? "Translating ..."
    : hasTranslation
      ? "Re-translate"
      : "Translate description";
  const descriptionProgress = translationProgress?.target === "description" && translationProgress.novelId === currentNovel.id ? translationProgress : null;

  function toggleChapterSortOrder() {
    if (chapterSortAnimationTimerRef.current) window.clearTimeout(chapterSortAnimationTimerRef.current);
    setIsChapterSortAnimating(true);
    setChapterSortOrder((current) => current === "asc" ? "desc" : "asc");
    chapterSortAnimationTimerRef.current = window.setTimeout(() => {
      setIsChapterSortAnimating(false);
      chapterSortAnimationTimerRef.current = null;
    }, 420);
  }

  async function pasteChapter() {
    try {
      setRawText(await navigator.clipboard.readText());
    } catch {
      return;
    }
  }

  function openEditNovel() {
    setEditNovelTitle(currentNovel.title);
    setEditNovelDescription(currentNovel.description);
    setEditNovelTranslatedDescription(currentNovel.descriptionTranslated ?? "");
    setEditNovelStyleGuideId(currentNovel.styleGuideId ?? "");
    setIsEditNovelOpen(true);
  }

  function submitNovelEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editNovelTitle.trim()) return;
    const changes = [
      editNovelTitle !== currentNovel.title ? "title" : null,
      editNovelDescription !== currentNovel.description
        ? "raw Chinese description"
        : null,
      currentNovel.descriptionTranslated !== undefined &&
      editNovelTranslatedDescription !== currentNovel.descriptionTranslated
        ? "translated description"
        : null,
      editNovelStyleGuideId !== (currentNovel.styleGuideId ?? "")
        ? "writing style"
        : null,
    ].filter(Boolean) as string[];
    if (changes.length === 0) {
      setConfirmAction({
        title: "No changes detected",
        body: `No editable fields changed for "${currentNovel.title}".`,
        confirmLabel: "Close",
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction({
      title: "Save novel changes?",
      body: `Update ${formatChangedFields(changes)} for "${currentNovel.title}".`,
      confirmLabel: "Save changes",
      onConfirm: () => {
        editNovel(currentNovel.id, {
          title: editNovelTitle,
          description: editNovelDescription,
          descriptionTranslated:
            currentNovel.descriptionTranslated !== undefined
              ? editNovelTranslatedDescription
              : undefined,
          styleGuideId: editNovelStyleGuideId || undefined,
        });
        setIsEditNovelOpen(false);
        setConfirmAction(null);
      },
    });
  }

  function requestDeleteNovel() {
    setConfirmAction({
      title: "Delete novel?",
      body: `Delete "${currentNovel.title}" and all chapters, glossary terms, and saved translations attached to it.`,
      confirmLabel: "Delete novel",
      destructive: true,
      onConfirm: () => {
        deleteNovel(currentNovel.id);
        setConfirmAction(null);
        router.push("/app/library");
      },
    });
  }

  function requestToggleNovelPublished() {
    const nextPublished = !currentNovel.published;
    setConfirmAction({
      title: nextPublished ? "Publish novel?" : "Unpublish novel?",
      body: nextPublished
        ? `Make "${currentNovel.title}" available to the reader app. Only published chapters will be visible there.`
        : `Remove "${currentNovel.title}" from the reader app without changing chapter publish settings.`,
      confirmLabel: nextPublished ? "Publish novel" : "Unpublish novel",
      destructive: !nextPublished,
      onConfirm: () => {
        setNovelPublished(currentNovel.id, nextPublished);
        setConfirmAction(null);
      },
    });
  }

  function requestSetChapterPublished(chapter: Chapter, published: boolean, version?: number) {
    setConfirmAction({
      title: published ? "Publish chapter?" : "Unpublish chapter?",
      body: published
        ? `Publish "${chapter.title}" using translation version ${version ?? chapter.currentVersion}.`
        : `Remove "${chapter.title}" from the reader app.`,
      confirmLabel: published ? "Publish chapter" : "Unpublish chapter",
      destructive: !published,
      onConfirm: () => {
        setChapterPublished(currentNovel.id, chapter.id, { published, version });
        setConfirmAction(null);
      },
    });
  }

  function requestPublishChapter(chapter: Chapter) {
    const versions = chapter.translations.filter(versionHasText);
    if (versions.length === 0) return;
    const defaultVersion = versions.some((version) => version.version === chapter.currentVersion)
      ? chapter.currentVersion
      : versions[versions.length - 1].version;
    if (versions.length > 1) {
      setPublishingChapter(chapter);
      setPublishVersion(String(defaultVersion));
      return;
    }
    requestSetChapterPublished(chapter, true, versions[0].version);
  }

  function submitPublishVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publishingChapter) return;
    const version = Number(publishVersion);
    if (!Number.isFinite(version)) return;
    setPublishingChapter(null);
    requestSetChapterPublished(publishingChapter, true, version);
  }
  function submitChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rawText.trim()) return;
    const chapterId = addChapter(
      currentNovel.id,
      chapterTitle,
      rawText,
      translatedChapterText,
    );
    if (chapterId) {
      setChapterTitle("");
      setRawText("");
      setTranslatedChapterText("");
      setIsAddChapterOpen(false);
    }
  }

  function startChapterDrag(
    event: DragEvent<HTMLButtonElement>,
    chapterId: string,
  ) {
    setDraggedChapterId(chapterId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chapterId);
  }

  function dragChapterOver(
    event: DragEvent<HTMLDivElement>,
    chapterId: string,
  ) {
    if (!draggedChapterId || draggedChapterId === chapterId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverChapterId(chapterId);
  }

  function dropChapter(event: DragEvent<HTMLDivElement>, chapterId: string) {
    event.preventDefault();
    const sourceId =
      event.dataTransfer.getData("text/plain") || draggedChapterId;
    if (sourceId && sourceId !== chapterId)
      reorderChapter(currentNovel.id, sourceId, chapterId);
    setDraggedChapterId(null);
    setDragOverChapterId(null);
  }

  function finishChapterDrag() {
    setDraggedChapterId(null);
    setDragOverChapterId(null);
  }

  function collapseSidebarForReader() {
    window.dispatchEvent(new Event("monochrome:collapse-sidebar"));
  }

  function requestDeleteChapter(chapterId: string, title: string) {
    setConfirmAction({
      title: "Delete chapter?",
      body: `Delete "${title}" and its translation history.`,
      confirmLabel: "Delete chapter",
      destructive: true,
      onConfirm: () => {
        deleteChapter(currentNovel.id, chapterId);
        setConfirmAction(null);
      },
    });
  }

  function submitTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceTerm.trim() || !translation.trim()) return;
    addTerm(currentNovel.id, {
      sourceTerm,
      translation,
      category,
      pinyin: pinyin || undefined,
      notes: notes || undefined,
    });
    setSourceTerm("");
    setTranslation("");
    setPinyin("");
    setNotes("");
    setIsAddTermOpen(false);
  }


  async function copyGlossarySample() {
    try {
      await navigator.clipboard.writeText(GLOSSARY_SAMPLE_JSON);
      setMessage("Glossary JSON sample copied to clipboard.");
    } catch {
      setMessage("Unable to copy the sample JSON. Try again from a secure browser context.");
    }
  }

  async function uploadGlossaryFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (currentNovel.glossary.length > 0) {
      setMessage("Glossary upload is only available before any terms are added.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setMessage("Upload a JSON file using the sample glossary structure.");
      return;
    }
    try {
      const terms = parseGlossaryUploadJson(await file.text());
      const imported = importTerms(currentNovel.id, terms);
      setMessage(imported > 0 ? `Imported ${imported} glossary term${imported === 1 ? "" : "s"}.` : "No glossary terms were imported.");
      if (imported > 0) setGlossaryTab("approved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Glossary JSON could not be imported.");
    }
  }
  function openEditTerm(term: GlossaryTerm) {
    setEditingTerm(term);
    setEditTranslation(term.translation);
    setEditNotes(term.notes ?? "");
  }

  function submitEditTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTerm || !editTranslation.trim()) return;
    const term = editingTerm;
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
        editTerm(currentNovel.id, term.id, {
          translation: editTranslation.trim(),
          notes: nextNotes,
        });
        setEditingTerm(null);
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

  return (
    <div className="space-y-5">
      <section className="border border-foreground/10 bg-[var(--surface)] p-6 shadow-none">
        <div className="flex relative flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
              Novel
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">
              {currentNovel.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-foreground/55">
              <span>
                Style: {getStyle(currentNovel)?.name ?? "Plain"} /{" "}
                {currentNovel.chapters.length} chapters /{" "}
                {currentNovel.glossary.length} terms
              </span>
              <Badge active={Boolean(currentNovel.published)}>{currentNovel.published ? "Published" : "Draft"}</Badge>
            </p>
          </div>
          <div className="flex absolute top-0 right-0 max-w-fit sm:relative flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={requestToggleNovelPublished}
              className={`inline-flex min-h-10 items-center justify-center border p-3 font-inter text-xs font-light transition ${currentNovel.published ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : "border-foreground/15 bg-transparent text-foreground hover:bg-foreground/[0.04]"}`}
              title={currentNovel.published ? "Unpublish novel" : "Publish novel"}
            >
              {currentNovel.published ? <GlobeLock size={16} /> : <Globe2 size={16} />}
            </button>
            <button
              type="button"
              onClick={openEditNovel}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent p-3 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              onClick={requestDeleteNovel}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent p-3 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <Trash2 size={16} />
            </button>          </div>
        </div>

        <div className="mt-6 border-t border-foreground/10 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">
                {effectiveMode === "english" ? "English" : "Chinese"}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">
                Description
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasTranslation ? (
                <Mode
                  modes={["english", "chinese"]}
                  value={descriptionMode}
                  onChange={(value) =>
                    setDescriptionMode(value as DescriptionMode)
                  }
                />
              ) : null}
              <button
                type="button"
                onClick={() => translateDescription(currentNovel.id)}
                disabled={
                  !currentNovel.description.trim() || isDescriptionTranslating
                }
                title={
                  account.verified
                    ? descriptionButtonLabel
                    : "Add an API key in Account before translating."
                }
                className="inline-flex items-center gap-2 inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:bg-foreground/[0.06] disabled:text-foreground/35"
              >
                {isDescriptionTranslating ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : null}
                <span>{descriptionButtonLabel}</span>
              </button>
            </div>
          </div>
          <div className="relative mt-4 overflow-hidden rounded-lg">
            <article
              className={`whitespace-pre-wrap text-base leading-7 text-foreground/80 transition duration-300 ${descriptionProgress ? "blur-[2px] opacity-45" : ""} ${effectiveMode === "chinese" ? "font-serif" : ""}`}
            >
              {descriptionText
                ? normalizeDisplayText(descriptionText)
                : "No description yet."}
            </article>
            <TranslationProgressOverlay progress={descriptionProgress} />
          </div>
        </div>
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-foreground/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Mode
            modes={["chapters", "glossary"]}
            value={mainTab}
            onChange={(value) => setMainTab(value as MainTab)}
          />
          {mainTab === "chapters" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleChapterSortOrder}
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                aria-label={`Show chapters in ${chapterSortOrder === "asc" ? "descending" : "ascending"} order`}
                title={`Show ${chapterSortOrder === "asc" ? "latest" : "oldest"} chapters first`}
              >
                {chapterSortOrder === "asc" ? <ArrowUpNarrowWide aria-hidden="true" className="h-4 w-4" /> : <ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4" />}
                <span>{chapterSortOrder === "asc" ? "Oldest first" : "Latest first"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddChapterOpen(true)}
                className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                Add chapter
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddTermOpen(true)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
            >
              Add term
            </button>
          )}
        </div>

        {mainTab === "chapters" ? (
          <>
            <p className="mt-4 text-sm text-foreground/55">
              Toggle display order here. Drag the handle beside a chapter to
              change saved reading and export order.
            </p>
            <div className="mt-3 divide-y divide-foreground/10 border-y border-foreground/10">
              {sortedChapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  onDragOver={(event) => dragChapterOver(event, chapter.id)}
                  onDragLeave={() =>
                    setDragOverChapterId((current) =>
                      current === chapter.id ? null : current,
                    )
                  }
                  onDrop={(event) => dropChapter(event, chapter.id)}
                  className={`flex flex-col gap-3 rounded-lg py-4 transition sm:flex-row sm:items-center sm:justify-between ${isChapterSortAnimating ? "animate-chapter-sort" : ""} ${dragOverChapterId === chapter.id ? "bg-foreground/[0.035] ring-1 ring-foreground/20" : ""} ${draggedChapterId === chapter.id ? "opacity-50" : ""}`}
                  style={isChapterSortAnimating ? { animationDelay: `${Math.min(index * 28, 180)}ms` } : undefined}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        startChapterDrag(event, chapter.id)
                      }
                      onDragEnd={finishChapterDrag}
                      aria-label={`Drag ${chapter.title} to reorder`}
                      title="Drag to reorder"
                      className="grid h-10 w-10 shrink-0 cursor-grab place-items-center border border-foreground/10 bg-[var(--surface)] text-foreground/40 transition hover:border-foreground/30 hover:bg-foreground/[0.04] hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/app/novels/${currentNovel.id}/chapters/${chapter.id}`}
                      onClick={collapseSidebarForReader}
                      className="flex min-h-10 min-w-0 flex-1 items-center px-2 py-1 transition hover:bg-foreground/[0.035]"
                    >
                      <h3 className="truncate font-serif text-xl font-semibold leading-tight">
                        {chapter.title}
                      </h3>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                    <Status status={chapter.status} />
                    <Badge active={Boolean(chapter.published)}>{chapter.published ? `Published v${chapter.publishedVersion ?? chapter.currentVersion}` : "Draft"}</Badge>
                    {chapter.published ? (
                      <button
                        type="button"
                        onClick={() => requestSetChapterPublished(chapter, false)}
                        className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestPublishChapter(chapter)}
                        disabled={!chapter.translations.some(versionHasText)}
                        title={chapter.translations.some(versionHasText) ? "Publish chapter" : "Translate this chapter before publishing."}
                        className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        requestDeleteChapter(chapter.id, chapter.title)
                      }
                      className="inline-flex min-h-10 items-center justify-center border border-transparent px-4 py-2 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {currentNovel.chapters.length === 0 ? (
                <Empty
                  title="No chapters yet"
                  body="Paste a chapter to begin."
                  action={
                    <button
                      type="button"
                      onClick={() => setIsAddChapterOpen(true)}
                      className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
                    >
                      Add chapter
                    </button>
                  }
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Mode
                modes={["approved", "pending", "rejected"]}
                value={glossaryTab}
                onChange={(value) => setGlossaryTab(value as GlossaryStatus)}
              />
              <CustomSelect
                label="Category"
                value={categoryFilter}
                onChange={(value) =>
                  setCategoryFilter(value as "all" | GlossaryCategory)
                }
                className="min-w-44"
                options={[
                  { value: "all", label: "All categories" },
                  ...GlossaryCategorySchema.options.map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
              <label className="relative block min-w-0 flex-1 text-sm font-medium text-foreground/70 sm:min-w-64">
                Search
                <Search aria-hidden="true" className="absolute left-3 top-[2.45rem] h-4 w-4 text-foreground/40" />
                <input
                  type="text"
                  value={glossarySearch}
                  onChange={(event) => setGlossarySearch(event.target.value)}
                  placeholder="Source, translation, pinyin, notes"
                  className="mt-1.5 w-full rounded-lg border border-foreground/10 bg-[var(--surface)] px-9 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/40 focus:border-foreground focus:ring-4 focus:ring-foreground/5"
                />
                {glossarySearch ? (
                  <button
                    type="button"
                    onClick={() => setGlossarySearch("")}
                    className="absolute right-2 top-[2.2rem] grid h-7 w-7 place-items-center rounded-md text-foreground/40 transition hover:bg-foreground/[0.04] hover:text-foreground"
                    aria-label="Clear glossary search"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </label>
              {currentNovel.glossary.length === 0 ? (
                <div className="flex flex-wrap gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={copyGlossarySample}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                  >
                    <Clipboard aria-hidden="true" className="h-4 w-4" />
                    Copy sample
                  </button>
                  <button
                    type="button"
                    onClick={() => glossaryFileInputRef.current?.click()}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    Upload JSON
                  </button>
                  <input ref={glossaryFileInputRef} type="file" accept="application/json,.json" onChange={uploadGlossaryFile} className="hidden" />
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              {terms.map((term) => (
                <div
                  key={term.id}
                  className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-4 shadow-sm transition hover:border-foreground/25"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold">
                        {term.sourceTerm}{" "}
                        <span className="font-sans text-base font-normal text-foreground/55">
                          -&gt; {term.translation}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-foreground/55">
                        {term.category}
                        {term.pinyin ? ` / ${term.pinyin}` : ""}
                      </p>
                      {term.notes ? (
                        <p className="mt-2 text-sm leading-6 text-foreground/60">
                          {term.notes}
                        </p>
                      ) : null}
                      {term.conflict ? (
                        <p className="mt-2 rounded-lg bg-foreground/[0.06] px-3 py-2 text-sm">
                          Conflict: {term.conflict}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTerm(term)}
                        className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
                      >
                        Edit
                      </button>
                      {term.status !== "approved" ? (
                        <button
                          type="button"
                          onClick={() => requestTermStatus(term, "approved")}
                          className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
                        >
                          Approve
                        </button>
                      ) : null}
                      {term.status !== "rejected" ? (
                        <button
                          type="button"
                          onClick={() => requestTermStatus(term, "rejected")}
                          className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
                        >
                          Reject
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => requestDeleteTerm(term)}
                        className="inline-flex min-h-10 items-center justify-center border border-transparent px-4 py-2 font-inter text-xs font-light text-foreground/60 transition hover:bg-foreground/[0.04] hover:text-foreground"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {terms.length === 0 ? (
                <Empty
                  title="No terms here"
                  body="No glossary terms match the selected status, category, and search."
                  action={
                    <button
                      type="button"
                      onClick={() => setIsAddTermOpen(true)}
                      className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
                    >
                      Add term
                    </button>
                  }
                />
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Modal
        title="Edit novel"
        open={isEditNovelOpen}
        onClose={() => setIsEditNovelOpen(false)}
      >
        <form onSubmit={submitNovelEdit} className="space-y-4">
          <Input
            label="Title"
            value={editNovelTitle}
            onChange={setEditNovelTitle}
          />
          <StyleSelect
            label="Writing style"
            value={editNovelStyleGuideId}
            onChange={setEditNovelStyleGuideId}
            styles={styles}
          />
          <Textarea
            label="Raw Chinese description"
            value={editNovelDescription}
            onChange={setEditNovelDescription}
            rows={6}
            className="font-serif leading-7"
          />
          <Textarea
            label="English description"
            value={editNovelTranslatedDescription}
            onChange={setEditNovelTranslatedDescription}
            rows={6}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditNovelOpen(false)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editNovelTitle.trim()}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
            >
              Save changes
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Add chapter"
        open={isAddChapterOpen}
        onClose={() => setIsAddChapterOpen(false)}
      >
        <form onSubmit={submitChapter} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground/55">
              Paste source text, then open the chapter to translate it.
            </p>
            <button
              type="button"
              onClick={pasteChapter}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Paste
            </button>
          </div>
          <div className="grid gap-3">
            <Input
              label="Title"
              value={chapterTitle}
              onChange={setChapterTitle}
            />
          </div>
          <Textarea
            label="Raw Chinese"
            value={rawText}
            onChange={setRawText}
            rows={12}
            className="font-serif leading-7"
          />
          <Textarea
            label="Translated English"
            value={translatedChapterText}
            onChange={setTranslatedChapterText}
            rows={12}
          />
          <div className="text-sm text-foreground/55">
            {rawText.length.toLocaleString()} /{" "}
            {DEFAULT_MAX_CHAPTER_CHARACTERS.toLocaleString()} characters
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddChapterOpen(false)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !rawText.trim() ||
                rawText.length > DEFAULT_MAX_CHAPTER_CHARACTERS
              }
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
            >
              Add chapter
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Add glossary term"
        open={isAddTermOpen}
        onClose={() => setIsAddTermOpen(false)}
      >
        <form onSubmit={submitTerm} className="space-y-4">
          <Input
            label="Source term"
            value={sourceTerm}
            onChange={setSourceTerm}
          />
          <Input
            label="Translation"
            value={translation}
            onChange={setTranslation}
          />
          <CustomSelect
            label="Category"
            value={category}
            onChange={(value) => setCategory(value as GlossaryCategory)}
            options={GlossaryCategorySchema.options.map((option) => ({
              value: option,
              label: option,
            }))}
          />
          <Input label="Pinyin" value={pinyin} onChange={setPinyin} />
          <Textarea label="Notes" value={notes} onChange={setNotes} rows={4} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddTermOpen(false)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!sourceTerm.trim() || !translation.trim()}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
            >
              Save term
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Edit glossary term"
        open={Boolean(editingTerm)}
        onClose={() => setEditingTerm(null)}
      >
        <form onSubmit={submitEditTerm} className="space-y-4">
          <div className="rounded-lg bg-foreground/[0.06] p-3 text-sm text-foreground/60">
            Source term:{" "}
            <span className="font-serif text-lg font-semibold text-foreground">
              {editingTerm?.sourceTerm}
            </span>
          </div>
          <Input
            label="Translation"
            value={editTranslation}
            onChange={setEditTranslation}
          />
          <Textarea
            label="Notes"
            value={editNotes}
            onChange={setEditNotes}
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingTerm(null)}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editTranslation.trim()}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
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
          <p className="text-sm leading-6 text-foreground/55">
            Choose the translation version that should be visible in the reader app.
          </p>
          <CustomSelect
            label="Published version"
            value={publishVersion}
            onChange={setPublishVersion}
            options={(publishingChapter?.translations ?? [])
              .filter(versionHasText)
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
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!publishVersion}
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
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














