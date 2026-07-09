import { Worker } from "bullmq";
import { TRANSLATION_QUEUE_NAME } from "../../src/lib/queue";
import { processTranslationJob, type WorkerJobData } from "./translate-job";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is required to start the translation worker.");
}

const worker = new Worker<WorkerJobData>(
  TRANSLATION_QUEUE_NAME,
  async (job) => {
    console.log(`Processing translation job ${job.id}`);
    return processTranslationJob(job.data);
  },
  { connection: { url: redisUrl }, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) },
);

worker.on("completed", (job) => console.log(`Completed translation job ${job.id}`));
worker.on("failed", (job, error) => console.error(`Failed translation job ${job?.id}:`, error));