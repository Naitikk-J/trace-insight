/**
 * Baseline route-risk model (in-process, deterministic).
 *
 * A logistic model over the versioned feature vector. The weights are explicit
 * constants, so every score decomposes into signed per-feature contributions —
 * an investigator (or a court) can see exactly why a route was prioritised.
 * Training a real model later replaces `WEIGHTS`/`BIAS` and the provider id;
 * nothing else in the pipeline moves.
 */
import { FEATURE_ORDER, type FeatureContribution, type MlProvider, type PathFeatures } from "./types";

const BIAS = -2.35;

/**
 * Weights encode investigative doctrine, not guesswork:
 * value that survives to a regulated venue is the actionable route, and
 * obfuscation infrastructure is the strongest evidence of intent.
 */
const WEIGHTS: Record<keyof PathFeatures, number> = {
  hopDepth: 0.55,
  valueRetention: 2.6,
  valueMagnitude: 0.85,
  velocity: 0.9,
  burstiness: 0.7,
  fanOut: 0.65,
  fanIn: 0.45,
  chainLinearity: 0.8,
  mixerExposure: 1.75,
  bridgeExposure: 0.95,
  illicitExposure: 2.1,
  attributionRisk: 1.9,
  terminatesAtVasp: 1.35,
  vaspProximity: 0.75,
  contractShare: 0.2,
  attributionCoverage: 0.4,
};

const NOTES: Record<keyof PathFeatures, string> = {
  hopDepth: "Layering depth of the route",
  valueRetention: "Share of the victim's funds still present at the endpoint",
  valueMagnitude: "Absolute value moved along the route",
  velocity: "Funds moved between hops with little delay",
  burstiness: "Hops cluster inside a short automated window",
  fanOut: "Value split across many counterparties",
  fanIn: "Value consolidated from many sources",
  chainLinearity: "Single-in/single-out peeling chain",
  mixerExposure: "Route passes through a mixer or privacy service",
  bridgeExposure: "Route crosses a bridge to another chain",
  illicitExposure: "Route touches sanctioned, darknet or theft-attributed addresses",
  attributionRisk: "Mean counterparty attribution risk",
  terminatesAtVasp: "Route ends at a regulated service that can be served",
  vaspProximity: "A regulated service sits close to the route",
  contractShare: "Route relies on smart contracts",
  attributionCoverage: "Share of the route with known attribution",
};

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export const baselineMlProvider: MlProvider = {
  id: "vasptrace-route-risk",
  version: "baseline-1.0.0",
  source: "baseline",

  async scorePaths(batch) {
    return batch.map(({ routeId, features }) => {
      let z = BIAS;
      const raw: FeatureContribution[] = [];

      for (const feature of FEATURE_ORDER) {
        const value = features[feature];
        const weight = WEIGHTS[feature];
        const term = value * weight;
        z += term;
        raw.push({
          feature,
          value,
          weight,
          // Filled in below, once the total logit magnitude is known.
          contribution: term,
          note: NOTES[feature],
        });
      }

      const probability = sigmoid(z);
      const routeScore = Math.max(0, Math.min(100, Math.round(probability * 100)));

      // Convert logit terms into score points so the parts sum to the whole.
      const totalTerm = raw.reduce((acc, item) => acc + Math.abs(item.contribution), 0) || 1;
      const contributions = raw
        .map((item) => ({
          ...item,
          contribution: Math.round((item.contribution / totalTerm) * routeScore * 10) / 10,
        }))
        .filter((item) => Math.abs(item.contribution) >= 0.5)
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

      // Confidence is an honest function of how much attribution we actually
      // had: a route through unlabelled addresses is scored, but not trusted.
      const confidence =
        Math.round(
          Math.max(
            0.35,
            Math.min(
              0.96,
              0.45 +
                features.attributionCoverage * 0.35 +
                (features.terminatesAtVasp ? 0.12 : 0) +
                (features.velocity > 0 ? 0.05 : 0),
            ),
          ) * 100,
        ) / 100;

      return { routeId, routeScore, confidence, contributions };
    });
  },

  async healthcheck() {
    return { ok: true, detail: "In-process baseline model" };
  },
};
