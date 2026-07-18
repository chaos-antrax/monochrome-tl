"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLibrary, useReader, type ReaderMode } from "../../../../../workspace/state";
import { ChapterPanel } from "../../../../../workspace/chapter-panel";
import {
  Card,
  ConfirmDialog,
  CustomSelect,
  Empty,
  formatChangedFields,
  Input,
  Modal,
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
  const { getNovel, getChapter, deleteChapter, editChapter, editChapterContent } = useLibrary();
  const { translateChapter, translationProgress, revertVersion, loadChapter } = useReader();
  const novel = getNovel(novelId);
  const chapter = getChapter(novelId, chapterId);
  const [mode, setMode] = useState<ReaderMode>("translated");
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [isMetaOpen, setIsMetaOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isContentEditing, setIsContentEditing] = useState(false);
  const [editRawText, setEditRawText] = useState("");
  const [editTranslatedText, setEditTranslatedText] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
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
            isEditingContent={isContentEditing}
            editRawText={editRawText}
            editTranslatedText={editTranslatedText}
            onEditRawText={setEditRawText}
            onEditTranslatedText={setEditTranslatedText}
            onStartEditContent={startContentEdit}
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



















