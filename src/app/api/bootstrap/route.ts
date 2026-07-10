import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getBootstrapState } from "@/lib/repository";
import { getSession } from "@/lib/session";

type BootstrapAppState = {
  novels?: Array<{ id: string; title: string; chapters?: unknown[]; glossary?: unknown[] }>;
  styles?: unknown[];
  jobs?: unknown[];
};

function summarizeAppState(appState: unknown) {
  const state = appState as BootstrapAppState | null;
  const novels = Array.isArray(state?.novels) ? state.novels : [];
  return {
    novelCount: novels.length,
    chapterCount: novels.reduce((total, novel) => total + (Array.isArray(novel.chapters) ? novel.chapters.length : 0), 0),
    glossaryTermCount: novels.reduce((total, novel) => total + (Array.isArray(novel.glossary) ? novel.glossary.length : 0), 0),
    styleCount: Array.isArray(state?.styles) ? state.styles.length : 0,
    jobCount: Array.isArray(state?.jobs) ? state.jobs.length : 0,
    novels: novels.map((novel) => ({
      id: novel.id,
      title: novel.title,
      chapterCount: Array.isArray(novel.chapters) ? novel.chapters.length : 0,
      glossaryTermCount: Array.isArray(novel.glossary) ? novel.glossary.length : 0,
    })),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null, appState: null, appStateSummary: summarizeAppState(null) });
    const bootstrap = await getBootstrapState(session.userId);
    return NextResponse.json({ ...bootstrap, appStateSummary: summarizeAppState(bootstrap.appState) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to bootstrap workspace.");
  }
}