"use client";

import React, { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MAX_CHAPTER_CHARACTERS, MAX_STYLE_GUIDE_CHARACTERS, PROVIDER_DEFAULTS } from "@/lib/constants";
import { type Provider } from "@/lib/schemas/translation";
import { cleanPastedChapterText, estimate, hashText, inferFallbackTerms, normalizeTranslatedText } from "./text-utils";
import type { Account, Chapter, ExportFormat, GlossaryStatus, GlossaryTerm, Job, NewTerm, Novel, StyleGuide, Tokens, TranslationProgress, TranslationVersion } from "./types";

export { cost, labelDate } from "./text-utils";
export type { Account, Chapter, ChapterStatus, ExportFormat, GlossaryStatus, GlossaryTerm, Job, JobStatus, NewTerm, Novel, ReaderMode, StyleGuide, Tokens, TranslationProgress, TranslationVersion } from "./types";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const styleSeed: StyleGuide[] = [];
const novelSeed: Novel[] = [];

type WorkspaceContextValue = {
  isBooting: boolean;
  account: Account;
  setAccount: React.Dispatch<React.SetStateAction<Account>>;
  novels: Novel[];
  styles: StyleGuide[];
  jobs: Job[];
  translationProgress: TranslationProgress | null;
  message: string;
  setMessage: (message: string) => void;
  usage: { tokens: Tokens; cost: number; translatedChapters: number };
  getNovel: (novelId: string) => Novel | undefined;
  getChapter: (novelId: string, chapterId: string) => Chapter | undefined;
  getStyle: (novel?: Novel) => StyleGuide | undefined;
  addNovel: (title: string, description: string, styleGuideId?: string) => string;
  editNovel: (novelId: string, values: { title: string; description: string; descriptionTranslated?: string; styleGuideId?: string }) => void;
  deleteNovel: (novelId: string) => void;
  addChapter: (novelId: string, title: string, volume: string, rawText: string) => string | null;
  editChapter: (novelId: string, chapterId: string, values: { title?: string; volume?: string; rawText?: string }) => void;
  deleteChapter: (novelId: string, chapterId: string) => void;
  moveChapter: (novelId: string, chapterId: string, direction: -1 | 1) => void;
  reorderChapter: (novelId: string, draggedChapterId: string, targetChapterId: string) => void;
  translateChapter: (novelId: string, chapterId: string, regenerate?: boolean) => void;
  translateDescription: (novelId: string) => void;
  revertVersion: (novelId: string, chapterId: string, version: number) => void;
  addTerm: (novelId: string, term: Omit<GlossaryTerm, "id" | "status">) => void;
  editTerm: (novelId: string, termId: string, values: Partial<GlossaryTerm>) => void;
  setTermStatus: (novelId: string, termId: string, status: GlossaryStatus) => void;
  deleteTerm: (novelId: string, termId: string) => void;
  addStyle: (name: string, content: string) => void;
  editStyle: (styleId: string, name: string, content: string) => void;
  deleteStyle: (styleId: string) => void;
  submitAuth: (mode: "signup" | "login", email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  saveProvider: (provider: Provider, apiKey: string, model: string) => Promise<boolean>;
  exportNovel: (novelId: string, format: ExportFormat) => void;
  printNovel: (novelId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>(() => ({ email: "", sessionExpiresAt: "", provider: "deepseek", selectedModel: PROVIDER_DEFAULTS.deepseek.defaultModel, verified: false }));
  const [isPersistReady, setIsPersistReady] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const persistenceErrorShownRef = useRef(false);
  const [novels, setNovels] = useState(novelSeed);
  const [styles, setStyles] = useState(styleSeed);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [message, setMessage] = useState("");
  const progressTimersRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadPersistedState() {
      try {
        const me = await fetch("/api/auth/me");
        const meData = (await me.json()) as { error?: string; user: null | { email: string; provider?: Provider; selectedModel?: string; hasApiKey?: boolean } };
        if (!me.ok) throw new Error(meData.error ?? "Unable to load account.");
        if (cancelled) return;
        if (meData.user) {
          setAccount((current) => ({ ...current, email: meData.user?.email ?? current.email, provider: meData.user?.provider ?? current.provider, selectedModel: meData.user?.selectedModel ?? current.selectedModel, apiKeyMasked: meData.user?.hasApiKey ? "stored securely" : current.apiKeyMasked, verified: Boolean(meData.user?.hasApiKey), sessionExpiresAt: new Date(Date.now() + 604800000).toISOString() }));
          const stateResponse = await fetch("/api/app-state");
          const stateData = (await stateResponse.json()) as { error?: string; appState?: { novels?: Novel[]; styles?: StyleGuide[]; jobs?: Job[] } };
          if (!stateResponse.ok) throw new Error(stateData.error ?? "Unable to load saved workspace.");
          if (!cancelled && stateData.appState) {
            setNovels(stateData.appState.novels ?? novelSeed);
            setStyles(stateData.appState.styles ?? styleSeed);
            setJobs(stateData.appState.jobs ?? []);
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
  }, []);

  useEffect(() => {
    if (!isPersistReady || !account.email) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/app-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ appState: { novels, styles, jobs } }) })
        .then(async (response) => {
          if (response.ok) {
            persistenceErrorShownRef.current = false;
            return;
          }
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Workspace changes could not be saved.");
        })
        .catch((error) => {
          if (persistenceErrorShownRef.current) return;
          persistenceErrorShownRef.current = true;
          setMessage(error instanceof Error ? error.message : "Workspace changes could not be saved.");
        });
    }, 600);
  }, [isPersistReady, account.email, novels, styles, jobs]);

  const usage = useMemo(() => calculateUsage(novels, jobs), [novels, jobs]);
  const getNovel = (novelId: string) => novels.find((item) => item.id === novelId);
  const getChapter = (novelId: string, chapterId: string) => getNovel(novelId)?.chapters.find((item) => item.id === chapterId);
  const getStyle = (novel?: Novel) => styles.find((item) => item.id === novel?.styleGuideId);
  const updateNovel = (novelId: string, updater: (novel: Novel) => Novel) => setNovels((current) => current.map((item) => item.id === novelId ? updater(item) : item));

  function clearTranslationProgressTimers() {
    progressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    progressTimersRef.current = [];
  }

  function startTranslationProgress(target: "chapter" | "description", novelId: string, chapterId?: string) {
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
  }

  function addNovel(title: string, description: string, styleGuideId?: string) {
    const next: Novel = { id: id("novel"), title: title.trim(), description: description.trim(), styleGuideId: styleGuideId || undefined, glossary: [], chapters: [] };
    setNovels((current) => [next, ...current]);
    return next.id;
  }

  function editNovel(novelId: string, values: { title: string; description: string; descriptionTranslated?: string; styleGuideId?: string }) {
    updateNovel(novelId, (novel) => {
      const description = values.description.trim();
      const translated = values.descriptionTranslated ? normalizeTranslatedText(values.descriptionTranslated) : undefined;
      return {
        ...novel,
        title: values.title.trim() || novel.title,
        description,
        descriptionTranslated: translated || (description === novel.description ? novel.descriptionTranslated : undefined),
        styleGuideId: values.styleGuideId || undefined,
      };
    });
  }

  function deleteNovel(novelId: string) {
    setNovels((current) => current.filter((item) => item.id !== novelId));
  }

  function addChapter(novelId: string, title: string, volume: string, rawText: string) {
    const novel = getNovel(novelId);
    const trimmed = cleanPastedChapterText(rawText);
    if (!novel || !trimmed || trimmed.length > DEFAULT_MAX_CHAPTER_CHARACTERS) return null;
    const next: Chapter = { id: id("chapter"), title: title.trim() || `Chapter ${novel.chapters.length + 1}`, volume: volume.trim() || "Volume 1", order: novel.chapters.length + 1, rawText: trimmed, rawTextHash: hashText(trimmed), status: "untranslated", translations: [], currentVersion: 0 };
    updateNovel(novelId, (item) => ({ ...item, chapters: [...item.chapters, next] }));
    return next.id;
  }

  function editChapter(novelId: string, chapterId: string, values: { title?: string; volume?: string; rawText?: string }) {
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((chapter) => {
      if (chapter.id !== chapterId) return chapter;
      const rawText = values.rawText === undefined ? undefined : cleanPastedChapterText(values.rawText);
      if (!rawText) return { ...chapter, title: values.title?.trim() || chapter.title, volume: values.volume?.trim() || chapter.volume };
      const rawTextHash = hashText(rawText);
      return { ...chapter, title: values.title?.trim() || chapter.title, volume: values.volume?.trim() || chapter.volume, rawText, rawTextHash, status: chapter.translations.some((version) => version.rawTextHash === rawTextHash) ? "translated" : "untranslated", error: undefined };
    }) }));
  }

  function deleteChapter(novelId: string, chapterId: string) {
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.filter((chapter) => chapter.id !== chapterId).map((chapter, index) => ({ ...chapter, order: index + 1 })) }));
  }

  function moveChapter(novelId: string, chapterId: string, direction: -1 | 1) {
    updateNovel(novelId, (novel) => {
      const chapters = [...novel.chapters];
      const index = chapters.findIndex((chapter) => chapter.id === chapterId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= chapters.length) return novel;
      [chapters[index], chapters[nextIndex]] = [chapters[nextIndex], chapters[index]];
      return { ...novel, chapters: chapters.map((chapter, orderIndex) => ({ ...chapter, order: orderIndex + 1 })) };
    });
  }

  function reorderChapter(novelId: string, draggedChapterId: string, targetChapterId: string) {
    if (draggedChapterId === targetChapterId) return;
    updateNovel(novelId, (novel) => {
      const chapters = [...novel.chapters];
      const fromIndex = chapters.findIndex((chapter) => chapter.id === draggedChapterId);
      const toIndex = chapters.findIndex((chapter) => chapter.id === targetChapterId);
      if (fromIndex < 0 || toIndex < 0) return novel;
      const [moved] = chapters.splice(fromIndex, 1);
      chapters.splice(toIndex, 0, moved);
      return { ...novel, chapters: chapters.map((chapter, orderIndex) => ({ ...chapter, order: orderIndex + 1 })) };
    });
  }

  function createJob(novelId: string, target: Job["target"], chapterId?: string) {
    const job: Job = { id: id("job"), novelId, chapterId, target, status: "queued", provider: account.provider, model: account.selectedModel, attempts: 1, createdAt: now() };
    setJobs((current) => [job, ...current]);
    return job;
  }

  async function readProviderError(response: Response) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    return data?.error ?? `Provider request failed with status ${response.status}.`;
  }

  function finishChapter(job: Job, novel: Novel, sourceChapter: Chapter, translatedText: string, newTerms: NewTerm[], memoryHit: boolean, title?: string) {
    const normalizedText = normalizeTranslatedText(translatedText);
    const usageEstimate = estimate(sourceChapter.rawText, normalizedText);
    updateNovel(novel.id, (currentNovel) => {
      const glossary = [...currentNovel.glossary];
      newTerms.forEach((newTerm) => {
        const sourceTerm = newTerm.sourceTerm.trim();
        const translation = newTerm.translation.trim();
        if (!sourceTerm || glossary.some((entry) => entry.sourceTerm === sourceTerm)) return;
        const conflict = glossary.find((entry) => entry.status === "approved" && entry.sourceTerm === sourceTerm && entry.translation !== translation);
        glossary.push({ id: id("term"), ...newTerm, sourceTerm, translation, status: "pending", discoveredInChapterId: sourceChapter.id, conflict: conflict ? `Approved term uses ${conflict.translation}` : undefined });
      });
      return { ...currentNovel, glossary, chapters: currentNovel.chapters.map((entry) => {
        if (entry.id !== sourceChapter.id) return entry;
        const versionNumber = entry.translations.length + 1;
        const version: TranslationVersion = { version: versionNumber, text: normalizedText, model: account.selectedModel, provider: account.provider, tokensUsed: usageEstimate.tokensUsed, estimatedCost: memoryHit ? 0 : usageEstimate.estimatedCost, createdAt: now(), rawTextHash: entry.rawTextHash };
        return { ...entry, title: title?.trim() || entry.title, status: "translated", translations: [...entry.translations, version], currentVersion: versionNumber };
      }) };
    });
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "completed", completedAt: now(), tokensUsed: usageEstimate.tokensUsed, estimatedCost: memoryHit ? 0 : usageEstimate.estimatedCost } : item));
  }

  function failChapter(job: Job, novelId: string, chapterId: string, error: string) {
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? { ...entry, status: "failed", error } : entry) }));
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "failed", completedAt: now(), error } : item));
    setMessage(error);
  }

  function translateChapter(novelId: string, chapterId: string, regenerate = false) {
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
    updateNovel(novelId, (item) => ({ ...item, chapters: item.chapters.map((entry) => entry.id === chapterId ? { ...entry, status: "translating", error: undefined } : entry) }));
    void (async () => {
      if (memoryHit) {
        progress.update(86, "Loading translation memory");
        finishChapter(job, novel, chapter, `${memoryHit.text}\n\n[Reused from translation memory.]`, [], true);
        progress.complete("Restoring saved translation");
        return;
      }
      try {
        const response = await fetch("/api/translate/chapter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rawChapterText: chapter.rawText, styleGuide: style?.content ?? null, glossary: novel.glossary.filter((entry) => entry.status === "approved" && chapter.rawText.includes(entry.sourceTerm)).map((entry) => ({ sourceTerm: entry.sourceTerm, translation: entry.translation, category: entry.category })) }) });
        if (!response.ok) throw new Error(await readProviderError(response));
        progress.update(90, "Processing provider response");
        const data = (await response.json()) as { response: { title?: string; translatedText: string; newTerms: NewTerm[] } };
        progress.update(96, "Saving chapter and glossary");
        finishChapter(job, novel, chapter, data.response.translatedText, data.response.newTerms.length ? data.response.newTerms : inferFallbackTerms(chapter.rawText, novel.glossary), false, data.response.title);
        progress.complete("Translation saved");
      } catch (error) {
        progress.fail();
        failChapter(job, novelId, chapterId, error instanceof Error ? error.message : "Translation failed.");
      }
    })();
  }

  function translateDescription(novelId: string) {
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
        const apiResponse = await fetch("/api/translate/description", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: novel.description, styleGuide: style?.content ?? null, glossary: novel.glossary.filter((entry) => entry.status === "approved" && novel.description.includes(entry.sourceTerm)).map((entry) => ({ sourceTerm: entry.sourceTerm, translation: entry.translation, category: entry.category })) }) });
        if (!apiResponse.ok) throw new Error(await readProviderError(apiResponse));
        progress.update(90, "Processing provider response");
        const data = (await apiResponse.json()) as { response: { translatedText: string; newTerms: NewTerm[] } };
        response = data.response;
      } catch (error) {
        progress.fail();
        setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "failed", completedAt: now(), error: error instanceof Error ? error.message : "Description translation failed." } : item));
        setMessage(error instanceof Error ? error.message : "Description translation failed.");
        return;
      }
      const normalizedText = normalizeTranslatedText(response.translatedText);
      const usageEstimate = estimate(novel.description, normalizedText);
      progress.update(96, "Saving translated description");
      updateNovel(novelId, (item) => ({ ...item, descriptionTranslated: normalizedText }));
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "completed", completedAt: now(), ...usageEstimate } : item));
      progress.complete("Description saved");
    })();
  }
  function revertVersion(novelId: string, chapterId: string, version: number) {
    updateNovel(novelId, (novel) => ({ ...novel, chapters: novel.chapters.map((entry) => entry.id === chapterId ? { ...entry, currentVersion: version, status: "translated" } : entry) }));
  }

  function addTerm(novelId: string, term: Omit<GlossaryTerm, "id" | "status">) {
    updateNovel(novelId, (novel) => novel.glossary.some((entry) => entry.sourceTerm === term.sourceTerm.trim()) ? novel : { ...novel, glossary: [...novel.glossary, { ...term, id: id("term"), sourceTerm: term.sourceTerm.trim(), translation: term.translation.trim(), status: "approved" }] });
  }

  function editTerm(novelId: string, termId: string, values: Partial<GlossaryTerm>) {
    updateNovel(novelId, (novel) => ({ ...novel, glossary: novel.glossary.map((entry) => entry.id === termId ? { ...entry, ...values, conflict: undefined } : entry) }));
  }

  function setTermStatus(novelId: string, termId: string, status: GlossaryStatus) {
    editTerm(novelId, termId, { status });
  }

  function deleteTerm(novelId: string, termId: string) {
    updateNovel(novelId, (novel) => ({ ...novel, glossary: novel.glossary.filter((entry) => entry.id !== termId) }));
  }

  function addStyle(name: string, content: string) {
    if (!name.trim() || !content.trim() || content.length > MAX_STYLE_GUIDE_CHARACTERS) return;
    const stamp = now();
    setStyles((current) => [...current, { id: id("style"), name: name.trim(), content: content.trim(), createdAt: stamp, updatedAt: stamp }]);
  }

  function editStyle(styleId: string, name: string, content: string) {
    if (!name.trim() || !content.trim() || content.length > MAX_STYLE_GUIDE_CHARACTERS) return;
    setStyles((current) => current.map((entry) => entry.id === styleId ? { ...entry, name: name.trim(), content: content.trim(), updatedAt: now() } : entry));
  }

  function deleteStyle(styleId: string) {
    setStyles((current) => current.filter((entry) => entry.id !== styleId));
    setNovels((current) => current.map((novel) => novel.styleGuideId === styleId ? { ...novel, styleGuideId: undefined } : novel));
  }

  async function submitAuth(mode: "signup" | "login", email: string, password: string) {
    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return false;
    }
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = (await response.json()) as { error?: string; user?: { email: string } };
      if (!response.ok) throw new Error(data.error ?? "Authentication failed.");
      setAccount((current) => ({ ...current, email: data.user?.email ?? email, sessionExpiresAt: new Date(Date.now() + 604800000).toISOString() }));
      setMessage(mode === "signup" ? "Account created and signed in." : "Signed in with a 7-day session.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Check MongoDB configuration.");
      return false;
    }
  }

  async function signOut() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally {
      setAccount((current) => ({ ...current, apiKeyMasked: undefined, verified: false, sessionExpiresAt: "" }));
      setMessage("Signed out.");
    }
  }

  async function saveProvider(provider: Provider, apiKey: string, model: string) {
    try {
      const response = await fetch("/api/provider", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey, model }) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Provider save failed.");
      setAccount((current) => ({ ...current, provider, selectedModel: model, apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`, verified: true }));
      setMessage("Provider settings encrypted and saved.");
      return true;
    } catch (error) {
      setAccount((current) => ({ ...current, provider, selectedModel: model, apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`, verified: true }));
      setMessage(error instanceof Error ? error.message : "Provider verified locally. Sign in with MongoDB configured to persist the encrypted key.");
      return false;
    }
  }

  function exportNovel(novelId: string, format: ExportFormat) {
    const novel = getNovel(novelId);
    if (!novel) return;
    void (async () => {
      const { buildEpubExport, buildExport, buildHtmlExport, downloadFile, downloadText, exportFileName } = await import("./export-utils");
      if (format === "txt") downloadText(exportFileName(novel.title, "txt"), "text/plain;charset=utf-8", buildExport(novel));
      if (format === "html") downloadText(exportFileName(novel.title, "html"), "text/html;charset=utf-8", buildHtmlExport(novel));
      if (format === "epub") downloadFile(exportFileName(novel.title, "epub"), buildEpubExport(novel));
    })();
  }

  function printNovel(novelId: string) {
    const novel = getNovel(novelId);
    if (!novel) return;
    void (async () => {
      const { buildHtmlExport, printHtml } = await import("./export-utils");
      printHtml(buildHtmlExport(novel));
    })();
  }

  return <WorkspaceContext.Provider value={{ isBooting: !isPersistReady, account, setAccount, novels, styles, jobs, translationProgress, message, setMessage, usage, getNovel, getChapter, getStyle, addNovel, editNovel, deleteNovel, addChapter, editChapter, deleteChapter, moveChapter, reorderChapter, translateChapter, translateDescription, revertVersion, addTerm, editTerm, setTermStatus, deleteTerm, addStyle, editStyle, deleteStyle, submitAuth, signOut, saveProvider, exportNovel, printNovel }}>{children}</WorkspaceContext.Provider>;
}

function calculateUsage(novels: Novel[], jobs: Job[]) {
  const versions = novels.flatMap((item) => item.chapters.flatMap((entry) => entry.translations));
  const versionTokens = versions.reduce<Tokens>((total, version) => ({ input: total.input + version.tokensUsed.input, output: total.output + version.tokensUsed.output }), { input: 0, output: 0 });
  const jobTokens = jobs.reduce<Tokens>((total, job) => ({ input: total.input + (job.tokensUsed?.input ?? 0), output: total.output + (job.tokensUsed?.output ?? 0) }), { input: 0, output: 0 });
  return { tokens: { input: versionTokens.input + jobTokens.input, output: versionTokens.output + jobTokens.output }, cost: versions.reduce((total, version) => total + version.estimatedCost, 0) + jobs.reduce((total, job) => total + (job.estimatedCost ?? 0), 0), translatedChapters: novels.flatMap((item) => item.chapters).filter((entry) => entry.status === "translated").length };
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return context;
}

export function preventSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}
