import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";
import { QUEUES } from "./names.js";
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const repoAnalysisQueue = new Queue(QUEUES.REPO_ANALYSIS, {
  connection,
});
