/**
 * Remote route-risk model adapter.
 *
 * Talks to a trained model service over HTTP using the dense feature vector in
 * schema order. Responses are validated before use: a malformed or partial
 * payload is rejected so the pipeline degrades to the baseline model instead of
 * publishing a score nobody can explain.
 */
import { z } from "zod";
import { env } from "../../config/env";
import { toFeatureVector } from "./features";
import { FEATURE_ORDER, FEATURE_SCHEMA_VERSION, type MlProvider } from "./types";

const contributionSchema = z.object({
  feature: z.enum(FEATURE_ORDER as [string, ...string[]]),
  value: z.coerce.number(),
  weight: z.coerce.number(),
  contribution: z.coerce.number(),
  note: z.string().min(1).max(240).optional(),
});

const predictionSchema = z.object({
  routeId: z.string().min(1),
  routeScore: z.coerce.number().min(0).max(100),
  confidence: z.coerce.number().min(0).max(1),
  contributions: z.array(contributionSchema).max(64).default([]),
});

const responseSchema = z.object({
  modelVersion: z.string().min(1).optional(),
  predictions: z.array(predictionSchema).max(256),
});

async function postJson(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const base = (env.MODEL_API_URL ?? "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(env.MODEL_API_KEY ? { "X-API-Key": env.MODEL_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Model service responded ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function createRemoteMlProvider(): MlProvider | null {
  if (env.ML_PROVIDER !== "remote" || !env.MODEL_API_URL) return null;

  return {
    id: "vasptrace-route-risk",
    version: env.MODEL_VERSION,
    source: "remote",

    async scorePaths(batch) {
      const payload = await postJson(
        "/v1/score/routes",
        {
          modelVersion: env.MODEL_VERSION,
          featureSchemaVersion: FEATURE_SCHEMA_VERSION,
          featureOrder: FEATURE_ORDER,
          routes: batch.map((item) => ({
            routeId: item.routeId,
            hopCount: Math.max(0, item.addresses.length - 1),
            features: item.features,
            vector: toFeatureVector(item.features),
          })),
        },
        env.MODEL_TIMEOUT_MS,
      );

      const parsed = responseSchema.parse(payload);
      const byRoute = new Map(parsed.predictions.map((p) => [p.routeId, p]));

      // Every requested route must come back, or the batch is not usable.
      return batch.map((item) => {
        const prediction = byRoute.get(item.routeId);
        if (!prediction) throw new Error(`Model service omitted route ${item.routeId}`);
        return {
          routeId: item.routeId,
          routeScore: Math.round(prediction.routeScore),
          confidence: Math.round(prediction.confidence * 100) / 100,
          contributions: prediction.contributions.map((c) => ({
            feature: c.feature as keyof (typeof item)["features"],
            value: c.value,
            weight: c.weight,
            contribution: Math.round(c.contribution * 10) / 10,
            note: c.note ?? c.feature,
          })),
        };
      });
    },

    async healthcheck() {
      const base = (env.MODEL_API_URL ?? "").replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(env.MODEL_TIMEOUT_MS, 5_000));
      try {
        const response = await fetch(`${base}/v1/health`, {
          headers: {
            Accept: "application/json",
            ...(env.MODEL_API_KEY ? { "X-API-Key": env.MODEL_API_KEY } : {}),
          },
          signal: controller.signal,
        });
        return response.ok
          ? { ok: true, detail: `Model service reachable (${env.MODEL_VERSION})` }
          : { ok: false, detail: `Model service responded ${response.status}` };
      } catch (error) {
        return {
          ok: false,
          detail: error instanceof Error ? error.message : "Model service unreachable",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
