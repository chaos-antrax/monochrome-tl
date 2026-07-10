import type { Job, Novel, Tokens } from "../types";

export function calculateUsage(novels: Novel[], jobs: Job[]) {
  const versions = novels.flatMap((item) => item.chapters.flatMap((entry) => entry.translations));
  const versionTokens = versions.reduce<Tokens>((total, version) => ({ input: total.input + version.tokensUsed.input, output: total.output + version.tokensUsed.output }), { input: 0, output: 0 });
  const jobTokens = jobs.reduce<Tokens>((total, job) => ({ input: total.input + (job.tokensUsed?.input ?? 0), output: total.output + (job.tokensUsed?.output ?? 0) }), { input: 0, output: 0 });
  return { tokens: { input: versionTokens.input + jobTokens.input, output: versionTokens.output + jobTokens.output }, cost: versions.reduce((total, version) => total + version.estimatedCost, 0) + jobs.reduce((total, job) => total + (job.estimatedCost ?? 0), 0), translatedChapters: novels.flatMap((item) => item.chapters).filter((entry) => entry.status === "translated").length };
}
