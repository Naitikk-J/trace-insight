import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load server/.env regardless of the cwd the process was started from.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine((v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"), {
      message: "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string",
    }),
  JWT_SECRET: z
    .string()
    .min(24, "JWT_SECRET must be at least 24 characters long"),
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
  CLIENT_URL: z.string().min(1).default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  // Fail loudly and early: a half-configured API is worse than no API.
  console.error(
    `\n[VASPTRACE] Invalid environment configuration:\n${details}\n\nCopy server/.env.example to server/.env and fill in the missing values.\n`,
  );
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isDevelopment: raw.NODE_ENV === "development",
  /** Every origin permitted by CORS. */
  allowedOrigins: raw.CLIENT_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
