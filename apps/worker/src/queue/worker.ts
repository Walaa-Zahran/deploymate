import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import { QUEUES } from "./names.js";

export function startWorkers() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const repoAnalysisWorker = new Worker(
    QUEUES.REPO_ANALYSIS,
    async (job: any) => {
      // This is where we’ll later clone repo + detect stack + call LLM
      console.log(`[worker] processing job ${job.id} on ${job.queueName}`);
      console.log(`[worker] payload:`, job.data);

      // Simulate work
      await new Promise((r) => setTimeout(r, 500));

      return {
        status: "done",
        received: job.data,
      };
    },
    { connection },
  );

  repoAnalysisWorker.on("completed", (job: any, result: any) => {
    console.log(`[worker] completed job ${job.id}`, result);
  });

  repoAnalysisWorker.on("failed", (job: any, err: any) => {
    console.error(`[worker] failed job ${job?.id}`, err);
  });

  console.log("[worker] workers started");
}
