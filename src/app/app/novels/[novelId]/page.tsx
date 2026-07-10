"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Edit2, GripVertical, LoaderCircle, Trash2 } from "lucide-react";
import { DEFAULT_MAX_CHAPTER_CHARACTERS } from "@/lib/constants";
import {
  GlossaryCategorySchema,
  type GlossaryCategory,
} from "@/lib/schemas/translation";
import {
  useWorkspace,
  type GlossaryStatus,
  type GlossaryTerm,
} from "../../../workspace/state";
import {
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
type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

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
  const {
    account,
    jobs,
    translationProgress,
    styles,
    getNovel,
    getStyle,
    editNovel,
    deleteNovel,
    translateDescription,
    addChapter,
    deleteChapter,
    reorderChapter,
    addTerm,
    editTerm,
    setTermStatus,
    deleteTerm,
  } = useWorkspace();
  const novel = getNovel(novelId);
  const [mainTab, setMainTab] = useState<MainTab>("chapters");
  const [descriptionMode, setDescriptionMode] =
    useState<DescriptionMode>("english");
  const [isEditNovelOpen, setIsEditNovelOpen] = useState(false);
  const [editNovelTitle, setEditNovelTitle] = useState("");
  const [editNovelDescription, setEditNovelDescription] = useState("");
  const [editNovelTranslatedDescription, setEditNovelTranslatedDescription] =
    useState("");
  const [editNovelStyleGuideId, setEditNovelStyleGuideId] = useState("");
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [volume, setVolume] = useState("Volume 1");
  const [rawText, setRawText] = useState("");
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null);
  const [dragOverChapterId, setDragOverChapterId] = useState<string | null>(
    null,
  );
  const [glossaryTab, setGlossaryTab] = useState<GlossaryStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | GlossaryCategory
  >("all");
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
  const terms = currentNovel.glossary.filter(
    (term) =>
      term.status === glossaryTab &&
      (categoryFilter === "all" || term.category === categoryFilter),
  );
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

  function submitChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rawText.trim()) return;
    const chapterId = addChapter(
      currentNovel.id,
      chapterTitle,
      volume,
      rawText,
    );
    if (chapterId) {
      setChapterTitle("");
      setRawText("");
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
      <section className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="flex relative flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
              Novel
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">
              {currentNovel.title}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Style: {getStyle(currentNovel)?.name ?? "Plain"} /{" "}
              {currentNovel.chapters.length} chapters /{" "}
              {currentNovel.glossary.length} terms
            </p>
          </div>
          <div className="flex absolute top-0 right-0 max-w-fit sm:relative flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={openEditNovel}
              className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm font-semibold transition hover:border-neutral-950"
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              onClick={requestDeleteNovel}
              className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              <Trash2 size={16} />
            </button>
            {/* <Link href="/app/library" className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-semibold transition hover:border-neutral-950">Library</Link> */}
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
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
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
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
              className={`whitespace-pre-wrap text-base leading-7 text-neutral-800 transition duration-300 ${descriptionProgress ? "blur-[2px] opacity-45" : ""} ${effectiveMode === "chinese" ? "font-serif" : ""}`}
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
        <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Mode
            modes={["chapters", "glossary"]}
            value={mainTab}
            onChange={(value) => setMainTab(value as MainTab)}
          />
          {mainTab === "chapters" ? (
            <button
              type="button"
              onClick={() => setIsAddChapterOpen(true)}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Add chapter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddTermOpen(true)}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Add term
            </button>
          )}
        </div>

        {mainTab === "chapters" ? (
          <>
            <p className="mt-4 text-sm text-neutral-500">
              Drag the handle beside a chapter to change reading and export
              order.
            </p>
            <div className="mt-3 divide-y divide-neutral-100">
              {currentNovel.chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  onDragOver={(event) => dragChapterOver(event, chapter.id)}
                  onDragLeave={() =>
                    setDragOverChapterId((current) =>
                      current === chapter.id ? null : current,
                    )
                  }
                  onDrop={(event) => dropChapter(event, chapter.id)}
                  className={`flex flex-col gap-3 rounded-lg py-4 transition sm:flex-row sm:items-center sm:justify-between ${dragOverChapterId === chapter.id ? "bg-neutral-50 ring-1 ring-neutral-300" : ""} ${draggedChapterId === chapter.id ? "opacity-50" : ""}`}
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
                      className="grid h-10 w-10 shrink-0 cursor-grab place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-400 transition hover:border-neutral-950 hover:text-neutral-950 active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/app/novels/${currentNovel.id}/chapters/${chapter.id}`}
                      onClick={collapseSidebarForReader}
                      className="min-w-0 flex-1 rounded-lg p-2 transition hover:bg-neutral-50"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        {chapter.volume} / Chapter {chapter.order}
                      </p>
                      <h3 className="mt-1 truncate font-serif text-xl font-semibold">
                        {chapter.title}
                      </h3>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                    <Status status={chapter.status} />
                    <button
                      type="button"
                      onClick={() =>
                        requestDeleteChapter(chapter.id, chapter.title)
                      }
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
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
                      className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            </div>
            <div className="grid gap-3">
              {terms.map((term) => (
                <div
                  key={term.id}
                  className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold">
                        {term.sourceTerm}{" "}
                        <span className="font-sans text-base font-normal text-neutral-500">
                          -&gt; {term.translation}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {term.category}
                        {term.pinyin ? ` / ${term.pinyin}` : ""}
                      </p>
                      {term.notes ? (
                        <p className="mt-2 text-sm leading-6 text-neutral-600">
                          {term.notes}
                        </p>
                      ) : null}
                      {term.conflict ? (
                        <p className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm">
                          Conflict: {term.conflict}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTerm(term)}
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950"
                      >
                        Edit
                      </button>
                      {term.status !== "approved" ? (
                        <button
                          type="button"
                          onClick={() => requestTermStatus(term, "approved")}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950"
                        >
                          Approve
                        </button>
                      ) : null}
                      {term.status !== "rejected" ? (
                        <button
                          type="button"
                          onClick={() => requestTermStatus(term, "rejected")}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-950"
                        >
                          Reject
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => requestDeleteTerm(term)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
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
                  body="No glossary terms match the selected status and category."
                  action={
                    <button
                      type="button"
                      onClick={() => setIsAddTermOpen(true)}
                      className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
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
          {currentNovel.descriptionTranslated !== undefined ? (
            <Textarea
              label="Translated description"
              value={editNovelTranslatedDescription}
              onChange={setEditNovelTranslatedDescription}
              rows={6}
            />
          ) : (
            <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
              Translate the description once to make the English version
              editable here.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditNovelOpen(false)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editNovelTitle.trim()}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
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
            <p className="text-sm text-neutral-500">
              Paste source text, then open the chapter to translate it.
            </p>
            <button
              type="button"
              onClick={pasteChapter}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Paste
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Title"
              value={chapterTitle}
              onChange={setChapterTitle}
            />
            <Input label="Volume / arc" value={volume} onChange={setVolume} />
          </div>
          <Textarea
            label="Raw Chinese"
            value={rawText}
            onChange={setRawText}
            rows={12}
            className="font-serif leading-7"
          />
          <div className="text-sm text-neutral-500">
            {rawText.length.toLocaleString()} /{" "}
            {DEFAULT_MAX_CHAPTER_CHARACTERS.toLocaleString()} characters
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddChapterOpen(false)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !rawText.trim() ||
                rawText.length > DEFAULT_MAX_CHAPTER_CHARACTERS
              }
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
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
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!sourceTerm.trim() || !translation.trim()}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
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
          <div className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">
            Source term:{" "}
            <span className="font-serif text-lg font-semibold text-neutral-950">
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
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editTranslation.trim()}
              className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              Save changes
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
