import { repoAnalysisQueue } from "../../queue/queues.js";
import { Router } from "express";

export const analysisRouter = Router();

/**
 * POST /analysis/repo
 * body: { repoUrl: string }
 */
analysisRouter.post("/repo", async (req, res, next) => {
  try {
    const { repoUrl } = req.body as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({ ok: false, error: "repoUrl is required" });
    }

    const job = await repoAnalysisQueue.add("analyzeRepo", {
      repoUrl,
      requestedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});
