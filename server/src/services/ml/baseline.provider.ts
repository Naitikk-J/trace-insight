/**
 * Baseline in-process route-scoring model.
 *
 * An explainable logistic model with explicit, versioned weights. It exists so
 * the platform always has a working scorer with full forensic transparency —
 * every score decomposes into signed per-feature contributions.
 */
import type { MlProvider, PathFeatureVector, ScoredRoute } from "./types";
import { FEATURE_KEYS } from "./types";

const WEIGHTS: Record<(typeof FEATURE_KEYS)[number], number> = {
  valueRetention: 1.6,
  valueMagnitude: 0.5,
  pathLength: 0.4,
  velocityGap: 1.1,
  maxFanOut: 0.7,
  linearity: 0.5,
  vaspProximity: 1.8,
  obfuscationExposure: 1.2,
  bridgeExposure: 0.8,
};
const BIAS = -2.1;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export const baselineMlProvider: MlProvider = {
  id: "tracify-baseline-logreg",
  kind: "baseline",
  version: "1.0.0",
  async score(featureSets: PathFeatureVector[]) {
    return featureSets.map((f) => {
      let z = BIAS;
      const contributions: ScoredRoute["contributions"] = [];
      for (const key of FEATURE_KEYS) {
        const weight = WEIGHTS[key];
        const value = f[key];
        const contribution = weight * value;
        z += contribution;
        contributions.push({
          feature: key,
          weight,
          value,
          contribution: Math.round(contribution * 1000) / 1000,
        });
      }
      contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      return { riskScore: Math.round(sigmoid(z) * 1000) / 1000, contributions };
    });
  },
};
