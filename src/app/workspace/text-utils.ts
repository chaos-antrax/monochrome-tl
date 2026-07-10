import type { GlossaryTerm, NewTerm, Tokens } from "./types";

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

const FALLBACK_TERM_BLOCKLIST = new Set([
  "一个", "一些", "一种", "一下", "这个", "那个", "这些", "那些", "自己", "什么", "怎么", "如此", "只是", "已经", "没有", "不是", "不能", "不会", "可以", "因为", "所以", "然后", "但是", "不过", "时候", "地方", "众人", "所有", "其中", "如今", "此时", "一切", "他们", "你们", "我们", "出来", "起来", "过去", "下来", "进去", "之中", "之前", "之后", "身上", "面前", "心中", "眼前", "声音", "气息", "神色", "目光", "修士", "灵气", "灵力", "境界", "阵法",
]);

export function inferFallbackTerms(rawText: string, existingTerms: GlossaryTerm[]): NewTerm[] {
  const existing = new Set(existingTerms.map((term) => term.sourceTerm.trim()).filter(Boolean));
  const matches = rawText.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];
  const counts = new Map<string, number>();
  matches.forEach((match) => {
    if (existing.has(match) || FALLBACK_TERM_BLOCKLIST.has(match)) return;
    counts.set(match, (counts.get(match) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sourceTerm]) => ({
      sourceTerm,
      translation: "Review needed",
      category: "other",
      notes: "Auto-detected candidate; add the preferred English term.",
    }));
}
