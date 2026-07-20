import type { Provider } from "@/lib/schemas/translation";
import type { NewTerm } from "../types";
import type { BootstrapResponse, FullChapterResponse, FullNovelResponse, WorkspaceMutation } from "./types";

async function readJsonError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export async function bootstrapWorkspace() {
  const response = await fetch("/api/bootstrap");
  const data = (await response.json()) as BootstrapResponse;
  if (!response.ok) throw new Error(data.error ?? "Unable to bootstrap workspace.");
  return data;
}

export async function persistWorkspaceMutationsRequest(mutations: WorkspaceMutation[]) {
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!response.ok) throw new Error(await readJsonError(response, "Workspace changes could not be saved."));
}

export async function loadFullChapterRequest(novelId: string, chapterId: string) {
  const response = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`);
  const data = (await response.json()) as FullChapterResponse;
  if (!response.ok || !data.chapter) throw new Error(data.error ?? "Unable to load chapter.");
  return data.chapter;
}

export async function loadFullNovelRequest(novelId: string) {
  const response = await fetch(`/api/novels/${novelId}`);
  const data = (await response.json()) as FullNovelResponse;
  if (!response.ok || !data.novel) throw new Error(data.error ?? "Unable to load novel.");
  return data.novel;
}

export async function translateChapterRequest(input: { rawChapterText: string; styleGuide: string | null; glossary: Array<{ sourceTerm: string; translation: string; category: string }> }) {
  const response = await fetch("/api/translate/chapter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await readJsonError(response, `Provider request failed with status ${response.status}.`));
  const data = (await response.json()) as { response: { title?: string; translatedText: string; newTerms: NewTerm[] } };
  return data.response;
}

export async function translateDescriptionRequest(input: { description: string; styleGuide: string | null; glossary: Array<{ sourceTerm: string; translation: string; category: string }> }) {
  const response = await fetch("/api/translate/description", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await readJsonError(response, `Provider request failed with status ${response.status}.`));
  const data = (await response.json()) as { response: { translatedText: string; newTerms: NewTerm[] } };
  return data.response;
}

export async function submitAuthRequest(mode: "signup" | "login", email: string, password: string) {
  const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = (await response.json()) as { error?: string; user?: { email: string; role?: import("@/lib/roles").UserRole } };
  if (!response.ok) throw new Error(data.error ?? "Authentication failed.");
  return data;
}

export async function signOutRequest() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function saveProviderRequest(provider: Provider, apiKey: string, model: string) {
  const response = await fetch("/api/provider", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey, model }) });
  if (!response.ok) throw new Error(await readJsonError(response, "Provider save failed."));
}

