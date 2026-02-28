import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  API_JWT_SECRET: z.string().min(10).default("dev_secret_change_me"),
  API_CORS_ORIGIN: z.string().default("http://localhost:4200"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(10),
});

export const env = EnvSchema.parse(process.env);
