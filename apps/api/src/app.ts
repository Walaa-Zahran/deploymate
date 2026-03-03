import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { analysisRouter } from "./modules/analysis/analysis.routes.js";
import { analysisDownloadRouter } from "./modules/analysis/analysis.download.routes.js";
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.API_CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/analysis", analysisRouter);
  app.use("/analysis", analysisDownloadRouter);
  // Health check (DigitalOcean uses this)
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", time: new Date().toISOString() });
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: "Not Found" });
  });

  // Error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ ok: false, error: "Internal Server Error" });
    },
  );

  return app;
}
