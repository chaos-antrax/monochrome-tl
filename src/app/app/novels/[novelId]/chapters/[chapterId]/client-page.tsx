"use client";

import Link from "next/link";
import {
  BookMarked,
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import {
  useLibrary,
  useReader,
  useToast,
  type Chapter,
  type GlossaryStatus,
  type GlossaryTerm,
  type ReaderMode,
} from "../../../../../workspace/state";
import { ChapterPanel } from "../../../../../workspace/chapter-panel";
import {
  GlossaryCategorySchema,
  type GlossaryCategory,
} from "@/lib/schemas/translation";
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

type EditTarget = "raw" | "translated";
type LexiconWordRole = "principle" | "secondary";

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const FONT_SIZE_OPTIONS = [16, 18, 19, 20, 22, 24, 26];
const LINE_HEIGHT_OPTIONS = [1.4, 1.5, 1.65, 1.8, 1.95, 2.1];

function versionHasText(version: Chapter["translations"][number]) {
  return Boolean(version.hasText || version.text.trim());
}

function splitLexiconWords(value: string) {
  return value
    .split(/[\n,]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getTextareaCaretMetrics(
  textarea: HTMLTextAreaElement,
  offset: number,
) {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const caret = document.createElement("span");
  const boundedOffset = Math.max(0, Math.min(offset, textarea.value.length));

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.left = "0";
  mirror.style.top = "0";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.font = computed.font;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = computed.wordBreak;
  mirror.style.tabSize = computed.tabSize;

  mirror.textContent = textarea.value.slice(0, boundedOffset);
  caret.textContent =
    textarea.value.slice(boundedOffset, boundedOffset + 1) || "\u200b";
  mirror.appendChild(caret);
  document.body.appendChild(mirror);

  const metrics = {
    top: caret.offsetTop,
    height: Number.parseFloat(computed.lineHeight) || textarea.clientHeight,
  };

  mirror.remove();
  return metrics;
}

export default function ReaderPage() {
  const { novelId, chapterId } = useParams<{
    novelId: string;
    chapterId: string;
  }>();
  const router = useRouter();
  const {
    getNovel,
    getChapter,
    deleteChapter,
    editChapter,
    editChapterContent,
    setChapterPublished,
    addTerm,
    editTerm,
    setTermStatus,
    deleteTerm,
    upsertLexiconEntry,
    reinforceChapterTerms,
    loadNovel,
  } = useLibrary();
  const { translateChapter, translationProgress, revertVersion, loadChapter } =
    useReader();
  const { setMessage } = useToast();
  const novel = getNovel(novelId);
  useEffect(() => {
    if (!novel || novel.isFull) return;
    void loadNovel(novel.id);
  }, [loadNovel, novel]);
  const chapter = getChapter(novelId, chapterId);
  const [mode, setMode] = useState<ReaderMode>("translated");
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [isMetaOpen, setIsMetaOpen] = useState(false);
  const [publishingChapter, setPublishingChapter] = useState<Chapter | null>(
    null,
  );
  const [publishVersion, setPublishVersion] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isContentEditing, setIsContentEditing] = useState(false);
  const [editRawText, setEditRawText] = useState("");
  const [editTranslatedText, setEditTranslatedText] = useState("");
  const [editTarget, setEditTarget] = useState<EditTarget>("raw");
  const [editSelectionOffset, setEditSelectionOffset] = useState(0);
  const [cursorIndicator, setCursorIndicator] = useState<{
    target: EditTarget;
    top: number;
    height: number;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryStatus, setGlossaryStatus] =
    useState<GlossaryStatus>("approved");
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [sourceTerm, setSourceTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState<GlossaryCategory>("character");
  const [pinyin, setPinyin] = useState("");
  const [notes, setNotes] = useState("");
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editorContextMenu, setEditorContextMenu] = useState<{
    x: number;
    y: number;
    word: string;
  } | null>(null);
  const [isLexiconDialogOpen, setIsLexiconDialogOpen] = useState(false);
  const [lexiconSelectedWord, setLexiconSelectedWord] = useState("");
  const [lexiconWordRole, setLexiconWordRole] =
    useState<LexiconWordRole>("principle");
  const [lexiconPrincipleWord, setLexiconPrincipleWord] = useState("");
  const [lexiconSecondaryWords, setLexiconSecondaryWords] = useState("");
  const [chapterLoadError, setChapterLoadError] = useState<{
    chapterId: string;
    message: string;
  } | null>(null);
  const chapterListRef = useRef<HTMLDivElement | null>(null);
  const rawEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const translatedEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorBodyRef = useRef<HTMLDivElement | null>(null);
  const cursorIndicatorTimerRef = useRef<number | null>(null);
  const loadingChapterRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (
      !chapter ||
      chapter.rawText ||
      chapterLoadError?.chapterId === chapterId
    )
      return;
    const loadKey = `${novelId}:${chapterId}`;
    if (loadingChapterRef.current === loadKey) return;
    loadingChapterRef.current = loadKey;
    void loadChapter(novelId, chapterId)
      .catch((error) => {
        if (!cancelled)
          setChapterLoadError({
            chapterId,
            message:
              error instanceof Error
                ? error.message
                : "Unable to load chapter.",
          });
      })
      .finally(() => {
        if (loadingChapterRef.current === loadKey)
          loadingChapterRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [chapter, chapterId, chapterLoadError?.chapterId, loadChapter, novelId]);
  useEffect(() => {
    if (!isGlossaryOpen && !isContentEditing) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isGlossaryOpen, isContentEditing]);

  useEffect(() => {
    if (!isContentEditing) return;
    const textarea =
      editTarget === "raw" ? rawEditorRef.current : translatedEditorRef.current;
    if (!textarea) return;

    let innerFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      const offset = Math.max(
        0,
        Math.min(editSelectionOffset, textarea.value.length),
      );
      const metrics = getTextareaCaretMetrics(textarea, offset);
      textarea.focus();
      textarea.setSelectionRange(offset, offset);
      textarea.scrollTop = Math.max(0, metrics.top - metrics.height * 4);

      innerFrame = window.requestAnimationFrame(() => {
        const visibleTop = Math.max(
          12,
          textarea.offsetTop + metrics.top - textarea.scrollTop - 1,
        );
        setCursorIndicator({
          target: editTarget,
          top: visibleTop,
          height: Math.max(24, metrics.height),
        });
        if (cursorIndicatorTimerRef.current)
          window.clearTimeout(cursorIndicatorTimerRef.current);
        cursorIndicatorTimerRef.current = window.setTimeout(
          () => setCursorIndicator(null),
          3200,
        );
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (innerFrame) window.cancelAnimationFrame(innerFrame);
    };
  }, [editSelectionOffset, editTarget, fontSize, isContentEditing, lineHeight]);

  useEffect(
    () => () => {
      if (cursorIndicatorTimerRef.current)
        window.clearTimeout(cursorIndicatorTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    const list = chapterListRef.current;
    if (!list) return;
    const saved = window.sessionStorage.getItem(
      `reader-chapter-list:${novelId}`,
    );
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
        <div className="h-3 w-24 animate-pulse rounded bg-foreground/10" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded bg-foreground/10" />
        <div className="mt-8 space-y-3">
          <div className="h-4 animate-pulse rounded bg-foreground/[0.06]" />
          <div className="h-4 animate-pulse rounded bg-foreground/[0.06]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-foreground/[0.06]" />
        </div>
      </Card>
    );

  if (chapterLoadError?.chapterId === chapter.id)
    return (
      <Empty
        title="Chapter could not be loaded"
        body={chapterLoadError.message}
      />
    );
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
  const chapterProgress =
    translationProgress?.target === "chapter" &&
    translationProgress.novelId === currentNovel.id &&
    translationProgress.chapterId === currentChapter.id
      ? translationProgress
      : null;
  const currentTranslation = currentChapter.translations.find(
    (item) => item.version === currentChapter.currentVersion,
  );
  const glossarySearchQuery = glossarySearch.trim().toLowerCase();
  const glossaryTerms = currentNovel.glossary.filter((term) => {
    const matchesSearch =
      !glossarySearchQuery ||
      [
        term.sourceTerm,
        term.translation,
        term.category,
        term.pinyin,
        term.notes,
        term.conflict,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(glossarySearchQuery),
        );
    return term.status === glossaryStatus && matchesSearch;
  });

  function saveChapterListScroll() {
    const list = chapterListRef.current;
    if (!list) return;
    window.sessionStorage.setItem(
      `reader-chapter-list:${currentNovel.id}`,
      String(list.scrollTop),
    );
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
    const selectedText = window.getSelection()?.toString().trim() ?? "";
    const rawOffset = selectedText
      ? currentChapter.rawText.indexOf(selectedText)
      : -1;
    const translatedOffset =
      selectedText && currentTranslation
        ? currentTranslation.text.indexOf(selectedText)
        : -1;
    let nextTarget: EditTarget = mode === "raw" ? "raw" : "translated";
    if (mode === "diff") {
      nextTarget =
        rawOffset >= 0 && translatedOffset < 0 ? "raw" : "translated";
    }
    if (!currentTranslation && nextTarget === "translated") nextTarget = "raw";
    const nextOffset = nextTarget === "raw" ? rawOffset : translatedOffset;
    if (mode === "translated" && !currentTranslation) setMode("raw");
    setEditTarget(nextTarget);
    setEditSelectionOffset(nextOffset >= 0 ? nextOffset : 0);
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
    const translationChanged =
      Boolean(currentTranslation) &&
      editTranslatedText !== currentTranslation?.text;
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
  function requestSetChapterPublished(
    targetChapter: Chapter,
    published: boolean,
    version?: number,
  ) {
    setConfirmAction({
      title: published ? "Publish chapter?" : "Unpublish chapter?",
      body: published
        ? `Publish "${targetChapter.title}" using translation version ${version ?? targetChapter.currentVersion}.`
        : `Remove "${targetChapter.title}" from the reader app.`,
      confirmLabel: published ? "Publish chapter" : "Unpublish chapter",
      destructive: !published,
      onConfirm: () => {
        setChapterPublished(currentNovel.id, targetChapter.id, {
          published,
          version,
        });
        setConfirmAction(null);
      },
    });
  }

  function requestPublishChapter() {
    const versions = currentChapter.translations.filter(versionHasText);
    if (versions.length === 0) return;
    const defaultVersion = versions.some(
      (version) => version.version === currentChapter.currentVersion,
    )
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

  function reinforceTerms() {
    const replacements = reinforceChapterTerms(
      currentNovel.id,
      currentChapter.id,
    );
    setMessage(
      replacements > 0
        ? `Reinforced ${replacements} term${replacements === 1 ? "" : "s"}.`
        : "No lexicon secondary terms were found in the current translation.",
    );
  }

  function openEditorContextMenu(event: MouseEvent<HTMLTextAreaElement>) {
    const selectedWord = event.currentTarget.value
      .slice(
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
      )
      .trim();
    if (!selectedWord || selectedWord.includes("\n")) return;
    event.preventDefault();
    setEditorContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 80),
      word: selectedWord,
    });
  }

  function openLexiconDialogFromSelection(word: string) {
    const firstPrinciple = (currentNovel.lexicon ?? [])[0]?.principleWord ?? "";
    setLexiconSelectedWord(word);
    setLexiconWordRole("principle");
    setLexiconPrincipleWord(firstPrinciple);
    setLexiconSecondaryWords("");
    setEditorContextMenu(null);
    setIsLexiconDialogOpen(true);
  }

  function closeLexiconDialog() {
    setIsLexiconDialogOpen(false);
    setLexiconSelectedWord("");
    setLexiconWordRole("principle");
    setLexiconPrincipleWord("");
    setLexiconSecondaryWords("");
  }

  function submitSelectedLexiconWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lexiconSelectedWord.trim()) return;
    if (lexiconWordRole === "principle") {
      const secondaries = splitLexiconWords(lexiconSecondaryWords);
      if (secondaries.length === 0) return;
      upsertLexiconEntry(currentNovel.id, lexiconSelectedWord, secondaries);
    } else {
      if (!lexiconPrincipleWord.trim()) return;
      upsertLexiconEntry(currentNovel.id, lexiconPrincipleWord, [
        lexiconSelectedWord,
      ]);
    }
    closeLexiconDialog();
    setMessage("Lexicon updated.");
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
        editTerm(currentNovel.id, term.id, {
          translation: editTranslation.trim(),
          notes: nextNotes,
        });
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
    <div className="grid min-h-[calc(100vh-2rem)] min-w-0 max-w-full gap-5 overflow-x-hidden xl:h-[calc(100vh-2rem)] xl:min-h-0 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-w-0 max-w-full flex-col overflow-hidden border border-foreground/10 bg-[var(--surface)] p-4 shadow-none xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:min-h-0">
        <Link
          href={`/app/novels/${currentNovel.id}`}
          className="w-fit text-sm font-semibold text-foreground/55 transition hover:text-foreground"
        >
          Back to novel
        </Link>
        <h1 className="mt-4 min-w-0 truncate font-serif text-2xl font-semibold">
          {currentNovel.title}
        </h1>
        <div
          ref={chapterListRef}
          onScroll={saveChapterListScroll}
          className="mt-4 flex max-h-[13rem] min-h-0 min-w-0 max-w-full flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 xl:max-h-none xl:flex-1 xl:pr-1"
        >
          {currentNovel.chapters.map((item) => (
            <Link
              key={item.id}
              href={`/app/novels/${currentNovel.id}/chapters/${item.id}`}
              scroll={false}
              onClick={saveChapterListScroll}
              className={`block min-h-16 min-w-0 max-w-full shrink-0 overflow-hidden rounded-lg px-3 py-2 text-sm transition ${item.id === currentChapter.id ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/[0.045] hover:text-foreground"}`}
            >
              <span className="block min-w-0 max-w-full truncate font-medium">
                {item.title}
              </span>
              <span className="block truncate text-xs opacity-60">
                {item.status}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-5 border-t border-foreground/10 pt-4 xl:mt-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">
            Reader
          </p>
          <div className="mt-3 grid gap-3">
            <CustomSelect
              label="Font size"
              value={String(fontSize)}
              onChange={(value) => setFontSize(Number(value))}
              options={FONT_SIZE_OPTIONS.map((value) => ({
                value: String(value),
                label: `${value}px`,
              }))}
              dropdownPlacement="up"
            />
            <CustomSelect
              label="Line height"
              value={String(lineHeight)}
              onChange={(value) => setLineHeight(Number(value))}
              options={LINE_HEIGHT_OPTIONS.map((value) => ({
                value: String(value),
                label: value.toFixed(2),
              }))}
              dropdownPlacement="up"
            />
          </div>
        </div>
      </aside>

      <Card className="flex min-h-[calc(100vh-2rem)] min-w-0 max-w-full flex-col overflow-hidden xl:h-[calc(100vh-2rem)] xl:min-h-0">
        <div className="xl:hidden">
          <ChapterNavigation
            novelId={currentNovel.id}
            previousChapter={previousChapter}
            nextChapter={nextChapter}
          />
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-foreground/10 pt-5 xl:mt-0 xl:border-t-0 xl:pt-0">
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
            onUnpublish={() =>
              requestSetChapterPublished(currentChapter, false)
            }
            onRevert={(version) =>
              revertVersion(currentNovel.id, currentChapter.id, version)
            }
            progress={chapterProgress}
          />
        </div>
        <div className="mt-6 border-t border-foreground/10 pt-5">
          <ChapterNavigation
            novelId={currentNovel.id}
            previousChapter={previousChapter}
            nextChapter={nextChapter}
          />
        </div>
      </Card>

      <div
        className={`fixed right-5 z-[80] flex flex-col items-end gap-3 sm:right-6 ${isContentEditing ? "top-5 bottom-auto sm:top-auto sm:bottom-6" : "bottom-5 sm:bottom-6"}`}
      >
        {isContentEditing ? (
          <>
            <button
              type="button"
              onClick={saveContentEdit}
              disabled={
                !editRawText.trim() ||
                (Boolean(currentTranslation) && !editTranslatedText.trim())
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background shadow-[0_14px_45px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-foreground/90 disabled:translate-y-0 disabled:bg-foreground/10 disabled:text-foreground/40"
              aria-label="Save chapter edits"
            >
              <Save aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              type="button"
              onClick={cancelContentEdit}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground/15 bg-background/90 px-5 py-2.5 font-inter text-xs font-light text-foreground shadow-[0_14px_45px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-foreground/[0.04]"
              aria-label="Cancel chapter edits"
            >
              <X aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsGlossaryOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground/15 bg-background/90 px-5 py-2.5 font-inter text-xs font-light text-foreground shadow-[0_14px_45px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-foreground/[0.04]"
              aria-label="Open reader glossary"
            >
              <BookOpenText aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">Glossary</span>
            </button>
            <button
              type="button"
              onClick={reinforceTerms}
              disabled={
                !currentTranslation?.text ||
                !(currentNovel.lexicon ?? []).length
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground/15 bg-background/90 px-5 py-2.5 font-inter text-xs font-light text-foreground shadow-[0_14px_45px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-foreground/[0.04] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Reinforce lexicon terms"
            >
              <Sparkles aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">Reinforce terms</span>
            </button>
            <button
              type="button"
              onClick={startContentEdit}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background shadow-[0_14px_45px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-foreground/90"
              aria-label="Edit chapter content"
            >
              <Edit3 aria-hidden="true" className="h-5 w-5" />
              <span className="hidden sm:inline">Edit chapter</span>
            </button>
          </>
        )}
      </div>

      {isContentEditing ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground animate-page">
          <div className="border-b border-foreground/10 bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
            <div className="mr-28 sm:mr-48">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
                Editing chapter
              </p>
              <h2 className="mt-1 truncate font-serif text-2xl font-semibold">
                {currentChapter.title}
              </h2>
            </div>
            {currentTranslation ? (
              <div className="mt-4 w-fit">
                <Mode
                  modes={["raw", "translated"]}
                  value={editTarget}
                  onChange={(value) => {
                    setEditSelectionOffset(0);
                    setEditTarget(value as EditTarget);
                  }}
                />
              </div>
            ) : null}
          </div>
          <div
            ref={editorBodyRef}
            className="relative min-h-0 flex-1 px-4 pb-4 pt-5 sm:px-10 sm:pb-10 sm:pt-8"
          >
            {editTarget === "raw" ? (
              <textarea
                ref={rawEditorRef}
                aria-label="Raw Chinese text"
                value={editRawText}
                onChange={(event) => setEditRawText(event.target.value)}
                onContextMenu={openEditorContextMenu}
                className="h-full w-full resize-none border-0 bg-transparent px-0 py-4 font-serif text-foreground outline-none selection:bg-foreground selection:text-background placeholder:text-foreground/40"
                style={{ fontSize, lineHeight, tabSize: 2 }}
                spellCheck={false}
              />
            ) : (
              <textarea
                ref={translatedEditorRef}
                aria-label="Translated text"
                value={editTranslatedText}
                onChange={(event) => setEditTranslatedText(event.target.value)}
                onContextMenu={openEditorContextMenu}
                className="h-full w-full resize-none border-0 bg-transparent px-0 py-4 font-serif text-foreground outline-none selection:bg-foreground selection:text-background placeholder:text-foreground/40"
                style={{ fontSize, lineHeight, tabSize: 2 }}
                spellCheck={false}
              />
            )}
            {cursorIndicator?.target === editTarget ? (
              <div
                className="pointer-events-none absolute inset-x-0 bg-foreground/10 animate-cursor-row-highlight"
                style={{
                  top: cursorIndicator.top,
                  height: cursorIndicator.height,
                }}
                aria-hidden="true"
              />
            ) : null}
            {editorContextMenu ? (
              <div
                className="fixed z-[95] border border-foreground/15 bg-background p-1 shadow-[0_18px_55px_rgba(0,0,0,0.16)] animate-select-pop"
                style={{ left: editorContextMenu.x, top: editorContextMenu.y }}
              >
                <button
                  type="button"
                  onClick={() =>
                    openLexiconDialogFromSelection(editorContextMenu.word)
                  }
                  className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.06]"
                >
                  <BookMarked aria-hidden="true" className="h-4 w-4" />
                  Add to lexicon
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isGlossaryOpen ? (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-foreground/25 backdrop-blur-sm animate-page"
          role="dialog"
          aria-modal="true"
          aria-label="Reader glossary"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close glossary"
            onClick={() => setIsGlossaryOpen(false)}
          />
          <aside className="relative flex h-full w-[min(100vw,31rem)] max-w-full flex-col border-l border-foreground/10 bg-[var(--surface)] shadow-[0_32px_100px_rgba(0,0,0,0.24)] animate-slide-in-right">
            <div className="border-b border-foreground/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">
                    Reader glossary
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">
                    {currentNovel.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGlossaryOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-foreground/55 transition hover:bg-foreground/[0.04] hover:text-foreground"
                  aria-label="Close glossary"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <Mode
                  modes={["approved", "pending", "rejected"]}
                  value={glossaryStatus}
                  onChange={(value) =>
                    setGlossaryStatus(value as GlossaryStatus)
                  }
                />
                <label className="relative block text-sm font-medium text-foreground/70">
                  Search
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-[2.45rem] h-4 w-4 text-foreground/40"
                  />
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
                <button
                  type="button"
                  onClick={() => setIsAddingTerm((current) => !current)}
                  className="inline-flex items-center gap-2 inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />{" "}
                  {isAddingTerm ? "Hide add form" : "Add term"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-24 sm:pb-5">
              {isAddingTerm ? (
                <form
                  onSubmit={submitGlossaryTerm}
                  className="mb-4 rounded-lg border border-foreground/10 bg-foreground/[0.025] p-4"
                >
                  <div className="grid gap-3">
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
                      onChange={(value) =>
                        setCategory(value as GlossaryCategory)
                      }
                      options={GlossaryCategorySchema.options.map((option) => ({
                        value: option,
                        label: option,
                      }))}
                    />
                    <Input label="Pinyin" value={pinyin} onChange={setPinyin} />
                    <Textarea
                      label="Notes"
                      value={notes}
                      onChange={setNotes}
                      rows={3}
                    />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetGlossaryForm}
                      className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
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
              ) : null}
              <div className="space-y-3">
                {glossaryTerms.map((term) => {
                  const isEditing = editingTerm?.id === term.id;
                  return (
                    <div
                      key={term.id}
                      className="rounded-lg border border-foreground/10 bg-[var(--surface)] p-4 shadow-sm transition hover:border-foreground/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-serif text-xl font-semibold text-foreground">
                            {term.sourceTerm}
                          </h3>
                          <p className="mt-1 break-words text-sm text-foreground/60">
                            {term.translation}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-foreground/55">
                            {term.category}
                            {term.pinyin ? ` / ${term.pinyin}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTerm(term)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-foreground/55 transition hover:bg-foreground/[0.04] hover:text-foreground"
                            aria-label={`Edit ${term.sourceTerm}`}
                          >
                            <Edit3 aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteGlossaryTerm(term)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-foreground/55 transition hover:bg-foreground/[0.04] hover:text-foreground"
                            aria-label={`Delete ${term.sourceTerm}`}
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {term.notes ? (
                        <p className="mt-3 text-sm leading-6 text-foreground/60">
                          {term.notes}
                        </p>
                      ) : null}
                      {term.conflict ? (
                        <p className="mt-3 rounded-lg bg-foreground/[0.06] px-3 py-2 text-sm text-foreground/70">
                          Conflict: {term.conflict}
                        </p>
                      ) : null}
                      {isEditing ? (
                        <form
                          onSubmit={submitGlossaryEdit}
                          className="mt-4 space-y-3 border-t border-foreground/10 pt-4"
                        >
                          <Input
                            label="Translation"
                            value={editTranslation}
                            onChange={setEditTranslation}
                          />
                          <Textarea
                            label="Notes"
                            value={editNotes}
                            onChange={setEditNotes}
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingTerm(null)}
                              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-4 py-2 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={!editTranslation.trim()}
                              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {term.status !== "approved" ? (
                          <button
                            type="button"
                            onClick={() =>
                              requestGlossaryStatus(term, "approved")
                            }
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 border border-foreground/15 bg-transparent px-3 py-1.5 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
                          >
                            <Check aria-hidden="true" className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        ) : null}
                        {term.status !== "rejected" ? (
                          <button
                            type="button"
                            onClick={() =>
                              requestGlossaryStatus(term, "rejected")
                            }
                            className="inline-flex min-h-9 items-center justify-center border border-foreground/15 bg-transparent px-3 py-1.5 font-inter text-xs font-light transition hover:bg-foreground/[0.04]"
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {glossaryTerms.length === 0 ? (
                  <Empty
                    title="No terms here"
                    body="No glossary terms match the selected status and search."
                  />
                ) : null}
              </div>
            </div>
            <div className="border-t border-foreground/10 bg-[var(--surface)] p-4 sm:hidden">
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="w-full inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-5 py-2.5 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
              >
                Close glossary
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        title="Add to lexicon"
        open={isLexiconDialogOpen}
        onClose={closeLexiconDialog}
      >
        <form onSubmit={submitSelectedLexiconWord} className="space-y-4">
          <div className="rounded-lg bg-foreground/[0.06] p-3 text-sm text-foreground/60">
            Selected word:{" "}
            <span className="font-serif text-lg font-semibold text-foreground">
              {lexiconSelectedWord}
            </span>
          </div>
          <Mode
            modes={["principle", "secondary"]}
            value={lexiconWordRole}
            onChange={(value) => setLexiconWordRole(value as LexiconWordRole)}
          />
          {lexiconWordRole === "principle" ? (
            <Textarea
              label="Secondary words"
              value={lexiconSecondaryWords}
              onChange={setLexiconSecondaryWords}
              placeholder="Separate words with commas or line breaks"
              rows={4}
            />
          ) : (currentNovel.lexicon ?? []).length ? (
            <CustomSelect
              label="Principle word"
              value={lexiconPrincipleWord}
              onChange={setLexiconPrincipleWord}
              options={(currentNovel.lexicon ?? []).map((entry) => ({
                value: entry.principleWord,
                label: entry.principleWord,
              }))}
            />
          ) : (
            <p className="text-sm leading-6 text-foreground/55">
              Create a principle word before adding secondary words.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeLexiconDialog}
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                lexiconWordRole === "principle"
                  ? splitLexiconWords(lexiconSecondaryWords).length === 0
                  : !lexiconPrincipleWord.trim()
              }
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90 disabled:bg-foreground/10 disabled:text-foreground/40"
            >
              Save to lexicon
            </button>
          </div>
        </form>
      </Modal>
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
              className="inline-flex min-h-10 items-center justify-center border border-foreground/15 bg-transparent px-5 py-2.5 font-inter text-xs font-light text-foreground transition hover:bg-foreground/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center border border-foreground bg-foreground px-4 py-2 font-inter text-xs font-light text-background transition hover:bg-foreground/90"
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
            Choose the translation version that should be visible in the reader
            app.
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
    "border-foreground/10 bg-[var(--surface)] text-foreground/75 hover:border-foreground/30 hover:bg-foreground/[0.035] hover:text-foreground";
  const disabled =
    "cursor-not-allowed border-foreground/10 bg-foreground/[0.025] text-foreground/30";

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
          <span className="min-w-0 flex-1 truncate">
            Previous: {previousChapter.title}
          </span>
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
          <span className="min-w-0 flex-1 truncate text-right sm:text-left">
            Next: {nextChapter.title}
          </span>
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
