import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import { QUEUES } from "./names.js";
import { prisma } from "../db/prisma.js";

export function startWorkers() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const repoAnalysisWorker = new Worker(
    QUEUES.REPO_ANALYSIS,
    async (job) => {
      console.log("[worker] got job:", job.id, job.data);
      const { runId, repoUrl } = job.data as { runId: string; repoUrl: string };

      console.log("[worker] updating RUNNING in DB for:", runId);

      // 1) RUNNING
      await prisma.analysisRun.update({
        where: { id: runId },
        data: { status: "RUNNING" },
      });
      console.log("[worker] RUNNING updated for:", runId);

      try {
        // 2) Do a lightweight “analysis” for now
        const result = {
          repoUrl,
          detected: {
            framework: repoUrl.includes("angular") ? "Angular" : "Unknown",
            language: "TypeScript",
          },
          generatedAt: new Date().toISOString(),
        };
        console.log("[worker] updating DONE in DB for:", runId);

        // 3) DONE + save result JSON
        await prisma.analysisRun.update({
          where: { id: runId },
          data: { status: "DONE", result },
        });
        console.log("[worker] DONE updated for:", runId);

        return result;
      } catch (e: any) {
        // 4) FAILED + save error
        await prisma.analysisRun.update({
          where: { id: runId },
          data: { status: "FAILED", error: e?.message ?? "Unknown error" },
        });
        throw e;
      }
    },
    { connection },
  );

  repoAnalysisWorker.on("completed", (job) => {
    console.log(`[worker] completed job ${job.id}`);
  });

  repoAnalysisWorker.on("failed", (job, err) => {
    console.error(`[worker] failed job ${job?.id}`, err);
  });

  console.log("[worker] workers started");
}
