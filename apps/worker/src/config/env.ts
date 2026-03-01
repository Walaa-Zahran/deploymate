import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  REDIS_URL: z.string().min(10),
  DATABASE_URL: z.string().min(10),

  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.string().min(10),
  LLM_MODEL: z.string().min(1).default("gpt-4o-mini"),
});

export const env = EnvSchema.parse(process.env);
