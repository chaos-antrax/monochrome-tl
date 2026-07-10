import type { Tokens } from "./types";

export const labelDate = (value?: string) => (value ? new Date(value).toLocaleString() : "Never");
export const cost = (value = 0) => `$${value.toFixed(4)}`;

export function hashText(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function estimate(input: string, output: string): { tokensUsed: Tokens; estimatedCost: number } {
  const tokensUsed = {
    input: Math.max(1, Math.ceil(input.length * 0.85)),
    output: Math.max(1, Math.ceil(output.length * 0.75)),
  };
  return { tokensUsed, estimatedCost: tokensUsed.input * 0.00000015 + tokensUsed.output * 0.0000006 };
}

export function normalizeTranslatedText(value: string) {
  const text = value
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.includes("\n") || text.length < 520) return text;

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 520 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs.join("\n\n");
}

export function cleanPastedChapterText(value: string) {
  const normalized = value.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const junkPatterns = [
    /^https?:\/\//i,
    /^www\./i,
    /^(previous|next|table of contents|chapter list|back to top)$/i,
    /^(login|sign in|register|subscribe|bookmark|report|comments?)\b/i,
    /^(translator|editor|proofreader|raw|source)\s*:/i,
    /all rights reserved|copyright|advertisement|support us|patreon|discord|read more|download app|novel updates/i,
  ];
  const cleaned = lines.filter((line) => {
    if (line.length > 280 && !/[\u4e00-\u9fff]/.test(line)) return false;
    return !junkPatterns.some((pattern) => pattern.test(line));
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}


