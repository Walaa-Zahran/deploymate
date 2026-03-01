import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import { QUEUES } from "./names.js";
import { prisma } from "../db/prisma.js";
import { detectStackFromRepoUrl } from "../services/stackDetector.js";
type AnalyzeRepoJob = {
  runId: string;
  repoUrl: string;
};
export function startWorkers() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const repoAnalysisWorker = new Worker(
    QUEUES.REPO_ANALYSIS,
    async (job) => {
      const data = job.data as AnalyzeRepoJob;
      const { runId, repoUrl } = data;
      console.log(`[worker] processing job ${job.id} runId=${runId}`);

      // 1) RUNNING
      await prisma.analysisRun.update({
        where: { id: runId },
        data: { status: "RUNNING" },
      });
      console.log("[worker] RUNNING updated for:", runId);

      try {
        // 2) analyze (placeholder logic)
        const detected = detectStackFromRepoUrl(repoUrl);

        const result = {
          repoUrl,
          detectedStack: detected,
          analyzedAt: new Date().toISOString(),
        };

        // 3) save result + mark DONE
        await prisma.analysisRun.update({
          where: { id: runId },
          data: {
            status: "DONE",
            result,
          },
        });

        return result;
      } catch (e: any) {
        // 4) mark FAILED
        const message = e?.message ?? "Unknown error";
        await prisma.analysisRun.update({
          where: { id: runId },
          data: { status: "FAILED", error: message },
        });
        throw e;
      }
    },
    { connection },
  );

  repoAnalysisWorker.on("completed", (job, result) => {
    console.log(`[worker] completed job ${job.id}`, result);
  });

  repoAnalysisWorker.on("failed", (job, err) => {
    console.error(`[worker] failed job ${job?.id}`, err);
  });

  console.log("[worker] workers started");
}
