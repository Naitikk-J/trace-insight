/**
 * Remote ML provider — adapter for a trained model service.
 *
 * When TRACIFY_ML_URL is unset or the call fails, callers degrade to the
 * baseline provider; scoring is never blocked by model-serving availability.
 */
import { logger } from "../../utils/logger";
import type { MlProvider } from "./types";
import { FEATURE_KEYS } from "./types";

export function createRemoteMlProvider(url: string, apiKey?: string, timeoutMs = 8_000): MlProvider {
  return {
    id: "tracify-remote-model",
    kind: "remote",
    version: "remote",
    async score(featureSets) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/v1/score-routes`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            features: featureSets.map((f) => FEATURE_KEYS.map((k) => f[k])),
            featureKeys: FEATURE_KEYS,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`ML service responded ${res.status}`);
        const body = (await res.json()) as { scores?: number[] };
        if (!Array.isArray(body.scores) || body.scores.length !== featureSets.length) {
          throw new Error("ML service returned malformed scores");
        }
        return body.scores.map((s) => ({
          riskScore: Math.max(0, Math.min(1, Number(s) || 0)),
          contributions: [], // remote model explainability not yet wired
        }));
      } catch (error) {
        logger.warn("remote ML scoring failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
