import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import { QUEUES } from "./queues.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export function startWorkers() {
  const repoWorker = new Worker(
    QUEUES.REPO_ANALYSIS,
    async (job) => {
      // For now i only log. Later i will:
      // - fetch repo files
      // - detect stack
      // - call LLM
      // - save outputs
      console.log(`[worker] Processing job ${job.id} in ${job.name}`);
      console.log("[worker] payload:", job.data);

      // simulate work
      await new Promise((r) => setTimeout(r, 800));

      return { ok: true, analyzedAt: new Date().toISOString() };
    },
    { connection },
  );

  repoWorker.on("completed", (job, result) => {
    console.log(`[worker]  completed job ${job.id}`, result);
  });

  repoWorker.on("failed", (job, err) => {
    console.error(`[worker] ❌ failed job ${job?.id}`, err);
  });

  console.log("[worker] workers started");
}
