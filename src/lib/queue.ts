import { Queue } from "bullmq";

export const TRANSLATION_QUEUE_NAME = "translation-jobs";

let queue: Queue | undefined;

export function getTranslationQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!queue) {
    queue = new Queue(TRANSLATION_QUEUE_NAME, { connection: { url: redisUrl } });
  }

  return queue;
}

export type TranslationJobPayload = {
  jobId: string;
  userId: string;
  novelId: string;
  chapterId: string;
};