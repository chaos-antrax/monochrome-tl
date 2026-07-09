import { TranslationRequestSchema, TranslationResponseSchema } from "../../src/lib/schemas/translation";
import { TRANSLATION_SYSTEM_PROMPT } from "../../src/lib/constants";

export type WorkerJobData = {
  jobId: string;
  userId: string;
  novelId: string;
  chapterId: string;
};

export async function processTranslationJob(data: WorkerJobData) {
  const request = TranslationRequestSchema.parse({
    systemPrompt: TRANSLATION_SYSTEM_PROMPT,
    styleGuide: null,
    glossary: [],
    rawChapterText: `Fetch chapter ${data.chapterId} from MongoDB before enabling live processing.`,
  });

  return TranslationResponseSchema.parse({
    translatedText: request.rawChapterText,
    newTerms: [],
  });
}