import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),
  DEFAULT_RETURN_WINDOW_DAYS: z.coerce.number().default(30),
  DEFAULT_WARRANTY_WINDOW_DAYS: z.coerce.number().default(365),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Throw rather than process.exit(1): on a persistent host this still crashes the process
  // immediately (an uncaught exception at module load), but on Vercel, exiting the process
  // abruptly instead of throwing appears to prevent the error from ever reaching the function's
  // logs -- surfacing only as an opaque FUNCTION_INVOCATION_FAILED with no message.
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;
