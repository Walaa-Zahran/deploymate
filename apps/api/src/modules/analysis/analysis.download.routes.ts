import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const analysisDownloadRouter = Router();

/**
 * GET /analysis/runs/:runId/download
 * Downloads zip stored in run.result.artifacts.zip.base64
 */
analysisDownloadRouter.get("/runs/:runId/download", async (req, res, next) => {
  try {
    const { runId } = req.params;

    const run = await prisma.analysisRun.findUnique({
      where: { id: runId },
    });

    if (!run?.result) {
      return res.status(404).json({ ok: false, error: "Run result not found" });
    }

    const result = run.result as any;
    const zip = result?.artifacts?.zip;

    if (!zip?.base64) {
      return res
        .status(404)
        .json({ ok: false, error: "Zip not available for this run" });
    }

    const filename = zip.filename ?? "deploymate-bundle.zip";
    const buffer = Buffer.from(zip.base64, "base64");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});
