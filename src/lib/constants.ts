export const MAX_STYLE_GUIDE_CHARACTERS = 1000;
export const DEFAULT_MAX_CHAPTER_CHARACTERS = 12000;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const PROVIDER_DEFAULTS = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    maxChapterCharacters: DEFAULT_MAX_CHAPTER_CHARACTERS,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    maxChapterCharacters: DEFAULT_MAX_CHAPTER_CHARACTERS,
  },
  zai: {
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4/",
    defaultModel: "glm-5.3-flash",
    maxChapterCharacters: DEFAULT_MAX_CHAPTER_CHARACTERS,
  },
} as const;

export const TRANSLATION_SYSTEM_PROMPT =
  "Translate Chinese web novel prose into fluent English. Preserve names and terminology from the glossary. Preserve paragraph structure and include natural paragraph line breaks in translatedText; do not return a single wall of prose. For chapter translations, return a title field containing the English chapter number and title in this exact format: Chapter 1478: Jade Fragrance Pavilion. Do not put site names, translator notes, ads, navigation text, or other source-page chrome in title or translatedText. Populate newTerms with important newly encountered glossary candidates, especially character names, places, organizations, techniques, artifacts, titles, and repeated domain terms. For each newTerms item include the Chinese sourceTerm, the actual English translation used in translatedText, category, and brief notes when helpful. If you are uncertain about a term translation, omit that term entirely; never use placeholders such as Review needed, unknown, TBD, or untranslated Chinese as the translation. Respond only with JSON matching the required schema.";
