import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const analysisRouter = Router();

analysisRouter.post("/repo", async (req, res, next) => {
  try {
    const { repoUrl } = req.body as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({ ok: false, error: "repoUrl is required" });
    }

    // create or fetch project
    const project = await prisma.project.upsert({
      where: { repoUrl },
      create: { repoUrl },
      update: {},
    });

    // create a run (queued)
    const run = await prisma.analysisRun.create({
      data: {
        projectId: project.id,
        status: "QUEUED",
      },
    });

    return res.json({
      ok: true,
      projectId: project.id,
      runId: run.id,
      status: run.status,
    });
  } catch (err) {
    next(err);
  }
});

analysisRouter.get("/runs/:runId", async (req, res, next) => {
  try {
    const { runId } = req.params;

    const run = await prisma.analysisRun.findUnique({
      where: { id: runId },
      include: { project: true },
    });

    if (!run) {
      return res.status(404).json({ ok: false, error: "Run not found" });
    }

    return res.json({
      ok: true,
      run: {
        id: run.id,
        status: run.status,
        result: run.result,
        error: run.error,
        repoUrl: run.project.repoUrl,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});
