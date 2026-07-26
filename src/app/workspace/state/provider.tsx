"use client";

import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MAX_CHAPTER_CHARACTERS, MAX_STYLE_GUIDE_CHARACTERS, PROVIDER_DEFAULTS } from "@/lib/constants";
import { type Provider } from "@/lib/schemas/translation";
import { cleanPastedChapterText, estimate, hashText, normalizeTranslatedText } from "../text-utils";
import type { Account, Chapter, ExportFormat, GlossaryStatus, GlossaryTerm, Job, NewTerm, Novel, StyleGuide, TranslationProgress, TranslationVersion } from "../types";
import { bootstrapWorkspace, loadFullChapterRequest, loadFullNovelRequest, persistWorkspaceMutationsRequest, saveProviderRequest, signOutRequest, submitAuthRequest, translateChapterRequest, translateDescriptionRequest } from "./api";
import { AuthContext, LibraryContext, ReaderContext, SettingsContext, ToastContext } from "./contexts";
import type { AuthContextValue, BootstrapResponse, LibraryContextValue, ReaderContextValue, SettingsContextValue, ToastContextValue, WorkspaceMutation } from "./types";
import { calculateUsage } from "./usage";


const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const styleSeed: StyleGuide[] = [];
const novelSeed: Novel[] = [];

function isUsableProviderTerm(term: NewTerm, sourceText: string) {
  const sourceTerm = term.sourceTerm.trim();
  const translation = term.translation.trim();
  if (!sourceTerm || !translation) return false;
  if (!sourceText.includes(sourceTerm)) return false;
  if (sourceTerm === translation) return false;
  if (/review needed|needs review|unknown|tbd|todo|n\/a/i.test(translation)) return false;
  if (!/[A-Za-z]/.test(translation)) return false;
  return true;
}
function defaultAccount(): Account {
  return {
    email: "",
    role: "reader",
    sessionExpiresAt: "",
    provider: "deepseek",
    selectedModel: PROVIDER_DEFAULTS.deepseek.defaultModel,
    verified: false,
  };
}

function accountFromBootstrap(data?: BootstrapResponse | null): Account {
  const base = defaultAccount();
  if (!data?.user) return base;
  return {
    ...base,
    email: data.user.email ?? base.email,
    role: data.user.role ?? base.role,
    provider: data.user.provider ?? base.provider,
    selectedModel: data.user.selectedModel ?? base.selectedModel,
    apiKeyMasked: data.user.hasApiKey ? "stored securely" : undefined,
    verified: Boolean(data.user.hasApiKey),
    sessionExpiresAt: new Date(Date.now() + 604800000).toISOString(),
  };
}

export function WorkspaceProvider({ children, initialBootstrap = null }: { children: ReactNode; initialBootstrap?: BootstrapResponse | null }) {
  const [account, setAccount] = useState<Account>(() => accountFromBootstrap(initialBootstrap));
  const [isPersistReady, setIsPersistReady] = useState(Boolean(initialBootstrap));
  const persistenceErrorShownRef = useRef(false);
  const [novels, setNovels] = useState(() => initialBootstrap?.appState?.novels ?? novelSeed);
  const [styles, setStyles] = useState(() => initialBootstrap?.appState?.styles ?? styleSeed);
  const [jobs, setJobs] = useState<Job[]>(() => initialBootstrap?.appState?.jobs ?? []);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [message, setMessage] = useState("");
  const progressTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (initialBootstrap) return;
    let cancelled = false;
    async function loadPersistedState() {
      try {
        const data = await bootstrapWorkspace();
        if (cancelled) return;
        if (data.user) {
          setAccount((current) => ({ ...current, email: data.user?.email ?? current.email, role: data.user?.role ?? current.role, provider: data.user?.provider ?? current.provider, selectedModel: data.user?.selectedModel ?? current.selectedModel, apiKeyMasked: data.user?.hasApiKey ? "stored securely" : current.apiKeyMasked, verified: Boolean(data.user?.hasApiKey), sessionExpiresAt: new Date(Date.now() + 604800000).toISOString() }));
          if (data.appState) {
            setNovels(data.appState.novels ?? novelSeed);
            setStyles(data.appState.styles ?? styleSeed);
            setJobs(data.appState.jobs ?? []);
          }
        }
      } catch (error) {
        if (!cancelled && window.location.pathname !== "/login") setMessage(error instanceof Error ? error.message : "Running in local-only mode. Configure MongoDB to persist across devices.");
      } finally {
        if (!cancelled) setIsPersistReady(true);
      }
    }
    void loadPersistedState();
    return () => { cancelled = true; };
  }, [initialBootstrap]);

  const persistWorkspaceMutations = useCallback((mutations: WorkspaceMutation[]) => {
    if (!account.email || mutations.length === 0) return;
    void persistWorkspaceMutationsRequest(mutations)
      .then(() => {
        persistenceErrorShownRef.current = false;
      })
      .catch((error) => {
        if (persistenceErrorShownRef.current) return;
        persistenceErrorShownRef.current = true;
        setMessage(error instanceof Error ? error.message : "Workspace changes could not be saved.");
      });
  }, [account.email]);
  const usage = useMemo(() => calculateUsage(novels, jobs), [novels, jobs]);
  const getNovel = useCallback((novelId: string) => novels.find((item) => item.id === novelId), [novels]);
  const getChapter = useCallback((novelId: string, chapterId: string) => getNovel(novelId)?.chapters.find((item) => item.id === chapterId), [getNovel]);
  const getStyle = useCallback((novel?: Novel) => styles.find((item) => item.id === novel?.styleGuideId), [styles]);
  const updateNovel = useCallback((novelId: string, updater: (novel: Novel) => Novel) => setNovels((current) => current.map((item) => item.id === novelId ? updater(item) : item)), []);

  const clearTranslationProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    progressTimersRef.current = [];
  
  }, []);

  const startTranslationProgress = useCallback((target: "chapter" | "description", novelId: string, chapterId?: string) => {
    clearTranslationProgressTimers();
    const progressId = id("progress");
    const initialLabel = target === "chapter" ? "Cleaning chapter text" : "Preparing description";
    const scheduledSteps = target === "chapter"
      ? [
          { delay: 240, percent: 16, label: "Preparing style and glossary" },
          { delay: 760, percent: 32, label: "Sending chapter to provider" },
          { delay: 1500, percent: 54, label: "Translating chapter" },
          { delay: 3200, percent: 72, label: "Extracting title and glossary" },
          { delay: 5600, percent: 88, label: "Waiting for final response" },
        ]
      : [
          { delay: 240, percent: 20, label: "Preparing style and glossary" },
          { delay: 760, percent: 38, label: "Sending description to provider" },
          { delay: 1500, percent: 62, label: "Translating description" },
          { delay: 3600, percent: 86, label: "Waiting for final response" },
        ];
    setTranslationProgress({ id: progressId, novelId, chapterId, target, percent: 8, label: initialLabel });
    scheduledSteps.forEach((step) => {
      const timer = window.setTimeout(() => {
        setTranslationProgress((current) => current?.id === progressId ? { ...current, percent: step.percent, label: step.label } : current);
      }, step.delay);
      progressTimersRef.current.push(timer);
    });
    return {
      update(percent: number, label: string) {
        setTranslationProgress((current) => current?.id === progressId ? { ...current, percent, label } : current);
      },
      complete(label = "Saving translation") {
        clearTranslationProgressTimers();
        setTranslationProgress((current) => current?.id === progressId ? { ...current, percent: 100, label } : current);
        const timer = window.setTimeout(() => {
          setTranslationProgress((current) => current?.id === progressId ? null : current);
        }, 650);
        progressTimersRef.current.push(timer);
      },
      fail() {
        clearTranslationProgressTimers();
        setTranslationProgress((current) => current?.id === progressId ? null : current);
      },
    };
  
  }, [clearTranslationProgressTimers]);

  const addNovel = useCallback((title: string, description: string, styleGuideId?: string) => {
    const next: Novel = { id: id("novel"), title: title.trim(), description: description.trim(), styleGuideId: styleGuideId || undefined, published: false, glossary: [], chapters: [] };
    setNovels((current) => [next, ...current]);
    persistWorkspaceMutations([{ type: "novel:upsert", novel: next }]);
    return next.id;
  }, [persistWorkspaceMutations]);

  const editNovel = useCallback((novelId: string, values: { title: string; description: string; descriptionTranslated?: string; styleGuideId?: string }) => {
    const currentNovel = getNovel(novelId);
    if (!currentNovel) return;
    const description = values.description.trim();
    const translated = values.descriptionTranslated ? normalizeTranslatedText(values.descriptionTranslated) : undefined;
    const nextNovel: Novel = {
      ...currentNovel,
      title: values.title.trim() || currentNovel.title,
      description,
      descriptionTranslated: translated || (description === currentNovel.description ? currentNovel.descriptionTranslated : undefined),
      styleGuideId: values.styleGuideId || undefined,
    };
    updateNovel(novelId, () => nextNovel);
    persistWorkspaceMutations([{ type: "novel:upsert", novel: nextNovel }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const deleteNovel = useCallback((novelId: string) => {
    setNovels((current) => current.filter((item) => item.id !== novelId));
    persistWorkspaceMutations([{ type: "novel:delete", novelId }]);
  }, [persistWorkspaceMutations]);

  const setNovelPublished = useCallback((novelId: string, published: boolean) => {
    const currentNovel = getNovel(novelId);
    if (!currentNovel) return;
    const nextNovel: Novel = {
      ...currentNovel,
      published,
      publishedAt: published ? currentNovel.publishedAt ?? now() : undefined,
    };
    updateNovel(novelId, () => nextNovel);
    persistWorkspaceMutations([{ type: "novel:upsert", novel: nextNovel }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const addChapter = useCallback((novelId: string, title: string, rawText: string) => {
    const novel = getNovel(novelId);
    const trimmed = cleanPastedChapterText(rawText);
    if (!novel || !trimmed || trimmed.length > DEFAULT_MAX_CHAPTER_CHARACTERS) return null;
    const next: Chapter = { id: id("chapter"), title: title.trim() || `Chapter ${novel.chapters.length + 1}`, order: novel.chapters.length + 1, rawText: trimmed, rawTextHash: hashText(trimmed), status: "untranslated", translations: [], currentVersion: 0, published: false };
    updateNovel(novelId, (item) => ({ ...item, chapters: [...item.chapters, next] }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: next }]);
    return next.id;
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const editChapter = useCallback((novelId: string, chapterId: string, values: { title?: string; rawText?: string }) => {
    const chapter = getChapter(novelId, chapterId);
    if (!chapter) return;
    const rawText = values.rawText === undefined ? undefined : cleanPastedChapterText(values.rawText);
    const rawTextHash = rawText ? hashText(rawText) : chapter.rawTextHash;
    const hasMatchingTranslation = chapter.translations.some((version) => version.rawTextHash === rawTextHash);
    const nextChapter: Chapter = rawText
      ? {
          ...chapter,
          title: values.title?.trim() || chapter.title,
          rawText,
          rawTextHash,
          status: hasMatchingTranslation ? "translated" : "untranslated",
          published: hasMatchingTranslation ? chapter.published : false,
          publishedVersion: hasMatchingTranslation ? chapter.publishedVersion : undefined,
          publishedAt: hasMatchingTranslation ? chapter.publishedAt : undefined,
          error: undefined,
        }
      : { ...chapter, title: values.title?.trim() || chapter.title };
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? nextChapter : entry) }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: nextChapter }]);
  }, [getChapter, persistWorkspaceMutations, updateNovel]);


  const editChapterContent = useCallback((novelId: string, chapterId: string, values: { rawText?: string; translatedText?: string }) => {
    const chapter = getChapter(novelId, chapterId);
    if (!chapter) return;
    const hasRawUpdate = values.rawText !== undefined;
    const hasTranslationUpdate = values.translatedText !== undefined;
    const rawText = hasRawUpdate ? cleanPastedChapterText(values.rawText ?? "") : chapter.rawText;
    if (hasRawUpdate && !rawText) return;
    const rawTextHash = hasRawUpdate ? hashText(rawText) : chapter.rawTextHash;
    const translatedText = hasTranslationUpdate ? normalizeTranslatedText(values.translatedText ?? "") : undefined;
    if (hasTranslationUpdate && !translatedText) return;
    const translations = chapter.translations.map((version) =>
      version.version === chapter.currentVersion
        ? {
            ...version,
            text: translatedText ?? version.text,
            rawTextHash,
          }
        : version,
    );
    const currentVersion = translations.find((version) => version.version === chapter.currentVersion);
    const nextChapter: Chapter = {
      ...chapter,
      rawText,
      rawTextHash,
      translations,
      status: currentVersion?.text ? "translated" : hasRawUpdate ? "untranslated" : chapter.status,
      error: undefined,
    };
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? nextChapter : entry) }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: nextChapter }]);
  }, [getChapter, persistWorkspaceMutations, updateNovel]);
  const setChapterPublished = useCallback(async (novelId: string, chapterId: string, values: { published: boolean; version?: number }) => {
    let chapter = getChapter(novelId, chapterId);
    if (!chapter) return;
    if (!chapter.rawText.trim()) {
      try {
        const fullChapter = await loadFullChapterRequest(novelId, chapterId);
        if (fullChapter.rawText.trim()) {
          chapter = fullChapter;
          updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? fullChapter : entry) }));
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load full chapter before changing publish state.");
      }
    }
    if (values.published) {
      const version = values.version ?? chapter.currentVersion;
      const hasVersion = chapter.translations.some((entry) => entry.version === version && (entry.hasText || entry.text.trim()));
      if (!hasVersion) return;
      const nextChapter: Chapter = {
        ...chapter,
        published: true,
        publishedVersion: version,
        publishedAt: chapter.published && chapter.publishedVersion === version ? chapter.publishedAt ?? now() : now(),
      };
      updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? nextChapter : entry) }));
      persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: nextChapter }]);
      return;
    }
    const nextChapter: Chapter = { ...chapter, published: false, publishedVersion: undefined, publishedAt: undefined };
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? nextChapter : entry) }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: nextChapter }]);
  }, [getChapter, persistWorkspaceMutations, setMessage, updateNovel]);
  const deleteChapter = useCallback((novelId: string, chapterId: string) => {
    const novel = getNovel(novelId);
    const nextChapters = novel?.chapters.filter((chapter) => chapter.id !== chapterId).map((chapter, index) => ({ ...chapter, order: index + 1 })) ?? [];
    updateNovel(novelId, (item) => ({ ...item, chapters: nextChapters }));
    persistWorkspaceMutations([{ type: "chapter:delete", novelId, chapterId, orderUpdates: nextChapters.map((chapter) => ({ id: chapter.id, order: chapter.order })) }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const moveChapter = useCallback((novelId: string, chapterId: string, direction: -1 | 1) => {
    const novel = getNovel(novelId);
    if (!novel) return;
    const chapters = [...novel.chapters];
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= chapters.length) return;
    [chapters[index], chapters[nextIndex]] = [chapters[nextIndex], chapters[index]];
    const nextChapters = chapters.map((chapter, orderIndex) => ({ ...chapter, order: orderIndex + 1 }));
    updateNovel(novelId, (item) => ({ ...item, chapters: nextChapters }));
    persistWorkspaceMutations([{ type: "chapters:reorder", novelId, chapters: nextChapters.map((chapter) => ({ id: chapter.id, order: chapter.order })) }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const reorderChapter = useCallback((novelId: string, draggedChapterId: string, targetChapterId: string) => {
    if (draggedChapterId === targetChapterId) return;
    const novel = getNovel(novelId);
    if (!novel) return;
    const chapters = [...novel.chapters];
    const fromIndex = chapters.findIndex((chapter) => chapter.id === draggedChapterId);
    const toIndex = chapters.findIndex((chapter) => chapter.id === targetChapterId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    const nextChapters = chapters.map((chapter, orderIndex) => ({ ...chapter, order: orderIndex + 1 }));
    updateNovel(novelId, (item) => ({ ...item, chapters: nextChapters }));
    persistWorkspaceMutations([{ type: "chapters:reorder", novelId, chapters: nextChapters.map((chapter) => ({ id: chapter.id, order: chapter.order })) }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const createJob = useCallback((novelId: string, target: Job["target"], chapterId?: string) => {
    const job: Job = { id: id("job"), novelId, chapterId, target, status: "queued", provider: account.provider, model: account.selectedModel, attempts: 1, createdAt: now() };
    setJobs((current) => [job, ...current]);
    persistWorkspaceMutations([{ type: "job:upsert", job }]);
    return job;
  }, [account.provider, account.selectedModel, persistWorkspaceMutations]);

  const finishChapter = useCallback((job: Job, novel: Novel, sourceChapter: Chapter, translatedText: string, newTerms: NewTerm[], memoryHit: boolean, title?: string) => {
    const normalizedText = normalizeTranslatedText(translatedText);
    const usageEstimate = estimate(sourceChapter.rawText, normalizedText);
    const glossary = [...novel.glossary];
    const persistedTerms: GlossaryTerm[] = [];
    newTerms.filter((newTerm) => isUsableProviderTerm(newTerm, sourceChapter.rawText)).forEach((newTerm) => {
      const sourceTerm = newTerm.sourceTerm.trim();
      const translation = newTerm.translation.trim();
      if (!sourceTerm || glossary.some((entry) => entry.sourceTerm === sourceTerm)) return;
      const conflict = glossary.find((entry) => entry.status === "approved" && entry.sourceTerm === sourceTerm && entry.translation !== translation);
      const term: GlossaryTerm = { id: id("term"), ...newTerm, sourceTerm, translation, status: "pending", discoveredInChapterId: sourceChapter.id, conflict: conflict ? `Approved term uses ${conflict.translation}` : undefined };
      glossary.push(term);
      persistedTerms.push(term);
    });
    const versionNumber = sourceChapter.translations.length + 1;
    const version: TranslationVersion = { version: versionNumber, text: normalizedText, model: account.selectedModel, provider: account.provider, tokensUsed: usageEstimate.tokensUsed, estimatedCost: memoryHit ? 0 : usageEstimate.estimatedCost, createdAt: now(), rawTextHash: sourceChapter.rawTextHash };
    const nextChapter: Chapter = { ...sourceChapter, title: title?.trim() || sourceChapter.title, status: "translated", translations: [...sourceChapter.translations, version], currentVersion: versionNumber };
    const completedJob: Job = { ...job, status: "completed", completedAt: now(), tokensUsed: usageEstimate.tokensUsed, estimatedCost: memoryHit ? 0 : usageEstimate.estimatedCost };
    updateNovel(novel.id, (currentNovel) => ({ ...currentNovel, glossary: [...currentNovel.glossary, ...persistedTerms.filter((term) => !currentNovel.glossary.some((entry) => entry.sourceTerm === term.sourceTerm))], chapters: currentNovel.chapters.map((entry) => entry.id === sourceChapter.id ? nextChapter : entry) }));
    setJobs((current) => current.map((item) => item.id === job.id ? completedJob : item));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId: novel.id, chapter: nextChapter }, ...persistedTerms.map((term): WorkspaceMutation => ({ type: "term:upsert", novelId: novel.id, term })), { type: "job:upsert", job: completedJob }]);
  }, [account.provider, account.selectedModel, persistWorkspaceMutations, updateNovel]);

  const failChapter = useCallback((job: Job, novelId: string, chapterId: string, error: string) => {
    const chapter = getChapter(novelId, chapterId);
    const failedChapter = chapter ? { ...chapter, status: "failed" as const, error } : null;
    const failedJob: Job = { ...job, status: "failed", completedAt: now(), error };
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? { ...entry, status: "failed", error } : entry) }));
    setJobs((current) => current.map((item) => item.id === job.id ? failedJob : item));
    persistWorkspaceMutations([...(failedChapter ? [{ type: "chapter:upsert" as const, novelId, chapter: failedChapter }] : []), { type: "job:upsert", job: failedJob }]);
    setMessage(error);
  }, [getChapter, persistWorkspaceMutations, updateNovel]);

  const translateChapter = useCallback((novelId: string, chapterId: string, regenerate = false) => {
    const novel = getNovel(novelId);
    const chapter = getChapter(novelId, chapterId);
    if (!novel || !chapter) return;
    if (!account.verified) {
      setMessage("Add and save an API key in Account before translating chapters.");
      return;
    }
    const style = getStyle(novel);
    const progress = startTranslationProgress("chapter", novelId, chapterId);
    const job = createJob(novelId, "chapter", chapterId);
    const memoryHit = !regenerate && chapter.translations.find((item) => item.rawTextHash === chapter.rawTextHash);
    const translatingChapter: Chapter = { ...chapter, status: "translating", error: undefined };
    updateNovel(novelId, (item) => ({ ...item, chapters: item.chapters.map((entry) => entry.id === chapterId ? translatingChapter : entry) }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: translatingChapter }]);
    void (async () => {
      if (memoryHit) {
        progress.update(86, "Loading translation memory");
        finishChapter(job, novel, chapter, `${memoryHit.text}\n\n[Reused from translation memory.]`, [], true);
        progress.complete("Restoring saved translation");
        return;
      }
      try {
        const response = await translateChapterRequest({ rawChapterText: chapter.rawText, styleGuide: style?.content ?? null, glossary: novel.glossary.filter((entry) => entry.status === "approved" && chapter.rawText.includes(entry.sourceTerm)).map((entry) => ({ sourceTerm: entry.sourceTerm, translation: entry.translation, category: entry.category })) });
        progress.update(90, "Processing provider response");
        progress.update(96, "Saving chapter and glossary");
        finishChapter(job, novel, chapter, response.translatedText, response.newTerms, false, response.title);
        progress.complete("Translation saved");
      } catch (error) {
        progress.fail();
        failChapter(job, novelId, chapterId, error instanceof Error ? error.message : "Translation failed.");
      }
    })();
  }, [account.verified, createJob, failChapter, finishChapter, getChapter, getNovel, getStyle, persistWorkspaceMutations, startTranslationProgress, updateNovel]);

  const translateDescription = useCallback((novelId: string) => {
    const novel = getNovel(novelId);
    if (!novel) return;
    if (!account.verified) {
      setMessage("Add and save an API key in Account before translating descriptions.");
      return;
    }
    const style = getStyle(novel);
    const progress = startTranslationProgress("description", novelId);
    const job = createJob(novelId, "description");
    void (async () => {
      let response: { translatedText: string; newTerms: NewTerm[] };
      try {
        response = await translateDescriptionRequest({ description: novel.description, styleGuide: style?.content ?? null, glossary: novel.glossary.filter((entry) => entry.status === "approved" && novel.description.includes(entry.sourceTerm)).map((entry) => ({ sourceTerm: entry.sourceTerm, translation: entry.translation, category: entry.category })) });
        progress.update(90, "Processing provider response");
      } catch (error) {
        progress.fail();
        const failedJob: Job = { ...job, status: "failed", completedAt: now(), error: error instanceof Error ? error.message : "Description translation failed." };
        setJobs((current) => current.map((item) => item.id === job.id ? failedJob : item));
        persistWorkspaceMutations([{ type: "job:upsert", job: failedJob }]);
        setMessage(error instanceof Error ? error.message : "Description translation failed.");
        return;
      }
      const normalizedText = normalizeTranslatedText(response.translatedText);
      const usageEstimate = estimate(novel.description, normalizedText);
      const nextNovel: Novel = { ...novel, descriptionTranslated: normalizedText };
      const completedJob: Job = { ...job, status: "completed", completedAt: now(), ...usageEstimate };
      progress.update(96, "Saving translated description");
      updateNovel(novelId, (item) => ({ ...item, descriptionTranslated: normalizedText }));
      setJobs((current) => current.map((item) => item.id === job.id ? completedJob : item));
      persistWorkspaceMutations([{ type: "novel:upsert", novel: nextNovel }, { type: "job:upsert", job: completedJob }]);
      progress.complete("Description saved");
    })();
  }, [account.verified, createJob, getNovel, getStyle, persistWorkspaceMutations, startTranslationProgress, updateNovel]);

  const revertVersion = useCallback((novelId: string, chapterId: string, version: number) => {
    const chapter = getChapter(novelId, chapterId);
    if (!chapter) return;
    const nextChapter: Chapter = { ...chapter, currentVersion: version, status: "translated" };
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? nextChapter : entry) }));
    persistWorkspaceMutations([{ type: "chapter:upsert", novelId, chapter: nextChapter }]);
  }, [getChapter, persistWorkspaceMutations, updateNovel]);

  const loadChapter = useCallback(async (novelId: string, chapterId: string) => {
    const current = getChapter(novelId, chapterId);
    if (current?.rawText && current.translations.every((version) => version.text || version.version !== current.currentVersion)) return;
    const chapter = await loadFullChapterRequest(novelId, chapterId);
    if (!chapter.rawText.trim()) throw new Error("Chapter source text is unavailable. Re-save the chapter source text before reading or translating it.");
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? chapter : entry) }));
  }, [getChapter, updateNovel]);

  const addTerm = useCallback((novelId: string, term: Omit<GlossaryTerm, "id" | "status">) => {
    const novel = getNovel(novelId);
    const sourceTerm = term.sourceTerm.trim();
    if (!novel || novel.glossary.some((entry) => entry.sourceTerm === sourceTerm)) return;
    const nextTerm: GlossaryTerm = { ...term, id: id("term"), sourceTerm, translation: term.translation.trim(), status: "approved" };
    updateNovel(novelId, (item) => ({ ...item, glossary: [...item.glossary, nextTerm] }));
    persistWorkspaceMutations([{ type: "term:upsert", novelId, term: nextTerm }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const editTerm = useCallback((novelId: string, termId: string, values: Partial<GlossaryTerm>) => {
    const novel = getNovel(novelId);
    const currentTerm = novel?.glossary.find((entry) => entry.id === termId);
    if (!currentTerm) return;
    const nextTerm: GlossaryTerm = { ...currentTerm, ...values, conflict: undefined };
    updateNovel(novelId, (item) => ({ ...item, glossary: item.glossary.map((entry) => entry.id === termId ? nextTerm : entry) }));
    persistWorkspaceMutations([{ type: "term:upsert", novelId, term: nextTerm }]);
  }, [getNovel, persistWorkspaceMutations, updateNovel]);

  const setTermStatus = useCallback((novelId: string, termId: string, status: GlossaryStatus) => {
    editTerm(novelId, termId, { status });
  }, [editTerm]);

  const deleteTerm = useCallback((novelId: string, termId: string) => {
    updateNovel(novelId, (novel) => ({ ...novel, glossary: novel.glossary.filter((entry) => entry.id !== termId) }));
    persistWorkspaceMutations([{ type: "term:delete", novelId, termId }]);
  }, [persistWorkspaceMutations, updateNovel]);

  const addStyle = useCallback((name: string, content: string) => {
    if (!name.trim() || !content.trim() || content.length > MAX_STYLE_GUIDE_CHARACTERS) return;
    const stamp = now();
    const nextStyle: StyleGuide = { id: id("style"), name: name.trim(), content: content.trim(), createdAt: stamp, updatedAt: stamp };
    setStyles((current) => [...current, nextStyle]);
    persistWorkspaceMutations([{ type: "style:upsert", style: nextStyle }]);
  }, [persistWorkspaceMutations]);

  const editStyle = useCallback((styleId: string, name: string, content: string) => {
    if (!name.trim() || !content.trim() || content.length > MAX_STYLE_GUIDE_CHARACTERS) return;
    const currentStyle = styles.find((entry) => entry.id === styleId);
    if (!currentStyle) return;
    const nextStyle: StyleGuide = { ...currentStyle, name: name.trim(), content: content.trim(), updatedAt: now() };
    setStyles((current) => current.map((entry) => entry.id === styleId ? nextStyle : entry));
    persistWorkspaceMutations([{ type: "style:upsert", style: nextStyle }]);
  }, [persistWorkspaceMutations, styles]);

  const deleteStyle = useCallback((styleId: string) => {
    setStyles((current) => current.filter((entry) => entry.id !== styleId));
    setNovels((current) => current.map((novel) => novel.styleGuideId === styleId ? { ...novel, styleGuideId: undefined } : novel));
    persistWorkspaceMutations([{ type: "style:delete", styleId }]);
  }, [persistWorkspaceMutations]);
  const submitAuth = useCallback(async (mode: "signup" | "login", email: string, password: string) => {
    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return false;
    }
    try {
      const data = await submitAuthRequest(mode, email, password);
      setAccount((current) => ({ ...current, email: data.user?.email ?? email, role: data.user?.role ?? current.role, sessionExpiresAt: new Date(Date.now() + 604800000).toISOString() }));
      setMessage(mode === "signup" ? "Account created and signed in." : "Signed in with a 7-day session.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Check MongoDB configuration.");
      return false;
    }
  
  }, []);

  const signOut = useCallback(async () => {
    try { await signOutRequest(); } finally {
      setAccount((current) => ({ ...current, apiKeyMasked: undefined, verified: false, sessionExpiresAt: "" }));
      setMessage("Signed out.");
    }
  
  }, []);

  const saveProvider = useCallback(async (provider: Provider, apiKey: string, model: string) => {
    try {
      await saveProviderRequest(provider, apiKey, model);
      setAccount((current) => ({ ...current, provider, selectedModel: model, apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`, verified: true }));
      setMessage("Provider settings encrypted and saved.");
      return true;
    } catch (error) {
      setAccount((current) => ({ ...current, provider, selectedModel: model, apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`, verified: true }));
      setMessage(error instanceof Error ? error.message : "Provider verified locally. Sign in with MongoDB configured to persist the encrypted key.");
      return false;
    }
  
  }, []);

  const loadNovel = useCallback(async (novelId: string) => {
    const novel = await loadFullNovelRequest(novelId);
    setNovels((current) => current.map((entry) => entry.id === novelId ? novel : entry));
    return novel;
  }, []);

  const exportNovel = useCallback((novelId: string, format: ExportFormat) => {
    void (async () => {
      try {
        const novel = await loadNovel(novelId);
        const { buildEpubExport, buildExport, buildHtmlExport, downloadFile, downloadText, exportFileName } = await import("../export-utils");
        if (format === "txt") downloadText(exportFileName(novel.title, "txt"), "text/plain;charset=utf-8", buildExport(novel));
        if (format === "html") downloadText(exportFileName(novel.title, "html"), "text/html;charset=utf-8", buildHtmlExport(novel));
        if (format === "epub") downloadFile(exportFileName(novel.title, "epub"), buildEpubExport(novel));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to export novel.");
      }
    })();
  }, [loadNovel]);

  const printNovel = useCallback((novelId: string) => {
    void (async () => {
      try {
        const novel = await loadNovel(novelId);
        const { buildHtmlExport, printHtml } = await import("../export-utils");
        printHtml(buildHtmlExport(novel));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to print novel.");
      }
    })();
  }, [loadNovel]);
  const authValue = useMemo<AuthContextValue>(() => ({ isBooting: !isPersistReady, account, setAccount, submitAuth, signOut, saveProvider }), [isPersistReady, account, submitAuth, signOut, saveProvider]);
  const libraryValue = useMemo<LibraryContextValue>(() => ({ novels, jobs, usage, getNovel, getChapter, addNovel, editNovel, deleteNovel, setNovelPublished, addChapter, editChapter, editChapterContent, setChapterPublished, deleteChapter, moveChapter, reorderChapter, addTerm, editTerm, setTermStatus, deleteTerm, exportNovel, printNovel, loadNovel }), [novels, jobs, usage, getNovel, getChapter, addNovel, editNovel, deleteNovel, setNovelPublished, addChapter, editChapter, editChapterContent, setChapterPublished, deleteChapter, moveChapter, reorderChapter, addTerm, editTerm, setTermStatus, deleteTerm, exportNovel, printNovel, loadNovel]);
  const readerValue = useMemo<ReaderContextValue>(() => ({ translationProgress, translateChapter, translateDescription, revertVersion, loadChapter }), [translationProgress, translateChapter, translateDescription, revertVersion, loadChapter]);
  const settingsValue = useMemo<SettingsContextValue>(() => ({ styles, getStyle, addStyle, editStyle, deleteStyle }), [styles, getStyle, addStyle, editStyle, deleteStyle]);
  const toastValue = useMemo<ToastContextValue>(() => ({ message, setMessage }), [message]);

  return (
    <AuthContext.Provider value={authValue}>
      <ToastContext.Provider value={toastValue}>
        <SettingsContext.Provider value={settingsValue}>
          <LibraryContext.Provider value={libraryValue}>
            <ReaderContext.Provider value={readerValue}>{children}</ReaderContext.Provider>
          </LibraryContext.Provider>
        </SettingsContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}







