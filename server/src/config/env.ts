import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load server/.env regardless of the cwd the process was started from.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().max(65535).default(5000),
    HOST: z.string().min(1).default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine((v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"), {
        message: "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string",
      }),
    JWT_SECRET: z.string().min(24, "JWT_SECRET must be at least 24 characters long"),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    CLIENT_URL: z.string().min(1).default("http://localhost:5173"),

    // GraphSense (chain data). Absent URL = deterministic synthetic provider.
    GRAPHSENSE_API_URL: z
      .string()
      .url("GRAPHSENSE_API_URL must be an absolute http(s) URL")
      .optional(),
    GRAPHSENSE_API_KEY: z.string().min(1).optional(),
    GRAPHSENSE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;

    // Production-only configuration mistakes are caught before the first request.
    const origins = value.CLIENT_URL.split(",").map((o) => o.trim());
    if (origins.some((o) => o === "*" )) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLIENT_URL"],
        message: "Wildcard CORS is not allowed in production — list explicit origins",
      });
    }
    if (origins.some((o) => o.includes("localhost") || o.includes("127.0.0.1"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLIENT_URL"],
        message: "Production CLIENT_URL must not point at localhost",
      });
    }
    if (value.GRAPHSENSE_API_URL && !value.GRAPHSENSE_API_URL.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GRAPHSENSE_API_URL"],
        message: "Production chain-data calls must use https",
      });
    }
    if (value.GRAPHSENSE_API_URL && !value.GRAPHSENSE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GRAPHSENSE_API_KEY"],
        message: "GRAPHSENSE_API_KEY is required when GRAPHSENSE_API_URL is set",
      });
    }
    if (/^(dev|test|change|secret|password)/i.test(value.JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET looks like a placeholder — use a long random value",
      });
    }
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
  /** True when a live chain-data provider is configured. */
  hasGraphSense: Boolean(raw.GRAPHSENSE_API_URL),
  /** Every origin permitted by CORS. */
  allowedOrigins: raw.CLIENT_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
