import type { Dispatch, SetStateAction } from "react";
import type { Provider } from "@/lib/schemas/translation";
import type { Account, Chapter, ExportFormat, GlossaryStatus, GlossaryTerm, Job, Novel, StyleGuide, Tokens, TranslationProgress } from "../types";

export type BootstrapResponse = {
  error?: string;
  user: null | { email: string; provider?: Provider; selectedModel?: string; hasApiKey?: boolean };
  appState: null | { novels?: Novel[]; styles?: StyleGuide[]; jobs?: Job[] };
};

export type FullChapterResponse = { error?: string; chapter?: Chapter };
export type FullNovelResponse = { error?: string; novel?: Novel };

export type WorkspaceMutation =
  | { type: "novel:upsert"; novel: Novel }
  | { type: "novel:delete"; novelId: string }
  | { type: "chapter:upsert"; novelId: string; chapter: Chapter }
  | { type: "chapter:delete"; novelId: string; chapterId: string; orderUpdates?: Array<{ id: string; order: number }> }
  | { type: "chapters:reorder"; novelId: string; chapters: Array<{ id: string; order: number }> }
  | { type: "term:upsert"; novelId: string; term: GlossaryTerm }
  | { type: "term:delete"; novelId: string; termId: string }
  | { type: "style:upsert"; style: StyleGuide }
  | { type: "style:delete"; styleId: string }
  | { type: "job:upsert"; job: Job };

export type WorkspaceContextValue = {
  isBooting: boolean;
  account: Account;
  setAccount: Dispatch<SetStateAction<Account>>;
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
  addChapter: (novelId: string, title: string, rawText: string) => string | null;
  editChapter: (novelId: string, chapterId: string, values: { title?: string; rawText?: string }) => void;
  editChapterContent: (novelId: string, chapterId: string, values: { rawText?: string; translatedText?: string }) => void;
  deleteChapter: (novelId: string, chapterId: string) => void;
  moveChapter: (novelId: string, chapterId: string, direction: -1 | 1) => void;
  reorderChapter: (novelId: string, draggedChapterId: string, targetChapterId: string) => void;
  translateChapter: (novelId: string, chapterId: string, regenerate?: boolean) => void;
  translateDescription: (novelId: string) => void;
  revertVersion: (novelId: string, chapterId: string, version: number) => void;
  loadChapter: (novelId: string, chapterId: string) => Promise<void>;
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

export type AuthContextValue = Pick<WorkspaceContextValue, "isBooting" | "account" | "setAccount" | "submitAuth" | "signOut" | "saveProvider">;
export type LibraryContextValue = Pick<WorkspaceContextValue, "novels" | "jobs" | "usage" | "getNovel" | "getChapter" | "addNovel" | "editNovel" | "deleteNovel" | "addChapter" | "editChapter" | "editChapterContent" | "deleteChapter" | "moveChapter" | "reorderChapter" | "addTerm" | "editTerm" | "setTermStatus" | "deleteTerm" | "exportNovel" | "printNovel">;
export type ReaderContextValue = Pick<WorkspaceContextValue, "translationProgress" | "translateChapter" | "translateDescription" | "revertVersion" | "loadChapter">;
export type SettingsContextValue = Pick<WorkspaceContextValue, "styles" | "getStyle" | "addStyle" | "editStyle" | "deleteStyle">;
export type ToastContextValue = Pick<WorkspaceContextValue, "message" | "setMessage">;




