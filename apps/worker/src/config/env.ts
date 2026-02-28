import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  REDIS_URL: z.string().min(10),
});

export const env = EnvSchema.parse(process.env);
