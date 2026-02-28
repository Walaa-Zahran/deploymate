export const QUEUES = {
  REPO_ANALYSIS: "repo-analysis",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
