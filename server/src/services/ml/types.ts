/**
 * VASPTRACE's own risk model — contract layer.
 *
 * This is AI System 1. It never talks to an external LLM and never generates
 * text: it consumes a fixed, versioned numeric feature vector describing one
 * candidate money route and returns a calibrated score. Because the vector is
 * an explicit schema (not free-form JSON), a trained model can replace the
 * in-process baseline without touching a single call site.
 */

/** Bump when the meaning or ordering of any feature changes. */
export const FEATURE_SCHEMA_VERSION = "1.0";

/**
 * Features of a single candidate route (root → leaf), all normalised to 0–1
 * unless documented otherwise. Every field is derived from observed chain data;
 * nothing here is inferred by a language model.
 */
export interface PathFeatures {
  /** Hop count scaled against an 8-hop reference graph. */
  hopDepth: number;
  /** Share of the seed value still present at the leaf. */
  valueRetention: number;
  /** Mean USD value per edge, log-scaled against a $1M reference. */
  valueMagnitude: number;
  /** Median minutes between consecutive hops, inverted (1 = near-instant). */
  velocity: number;
  /** Share of hops that occur inside a 30-minute burst window. */
  burstiness: number;
  /** Mean out-degree of the route's addresses, scaled against 8. */
  fanOut: number;
  /** Mean in-degree of the route's addresses, scaled against 8 (consolidation). */
  fanIn: number;
  /** Longest run of single-in/single-out hops — a peeling/layering chain. */
  chainLinearity: number;
  /** 1 when the route passes through a mixer or privacy service. */
  mixerExposure: number;
  /** 1 when the route passes through a bridge or cross-chain hop. */
  bridgeExposure: number;
  /** Share of the route's addresses attributed to sanctions/darknet/theft. */
  illicitExposure: number;
  /** Mean provider attribution risk across the route's addresses. */
  attributionRisk: number;
  /** 1 when the route ends at a custodial/regulated service. */
  terminatesAtVasp: number;
  /** Inverse hop distance to the nearest VASP on the route (1 = immediate). */
  vaspProximity: number;
  /** Share of the route's addresses that are smart contracts. */
  contractShare: number;
  /** Share of the route's addresses carrying any attribution tag at all. */
  attributionCoverage: number;
}

/** Feature order is part of the schema: remote models receive a dense vector. */
export const FEATURE_ORDER: (keyof PathFeatures)[] = [
  "hopDepth",
  "valueRetention",
  "valueMagnitude",
  "velocity",
  "burstiness",
  "fanOut",
  "fanIn",
  "chainLinearity",
  "mixerExposure",
  "bridgeExposure",
  "illicitExposure",
  "attributionRisk",
  "terminatesAtVasp",
  "vaspProximity",
  "contractShare",
  "attributionCoverage",
];

export type MlRiskBand = "low" | "moderate" | "elevated" | "high" | "severe";
export type MlPriority = "routine" | "priority" | "urgent";

/** One feature's signed contribution to the score — the explanation. */
export interface FeatureContribution {
  feature: keyof PathFeatures;
  value: number;
  weight: number;
  /** Signed points added to (or removed from) the 0–100 score. */
  contribution: number;
  note: string;
}

/** The model's verdict for one candidate money route. */
export interface PathPrediction {
  /** Stable identifier of the scored route (hash of its address trail). */
  routeId: string;
  addresses: string[];
  /** 0–100 likelihood this route is the laundering path worth acting on. */
  routeScore: number;
  band: MlRiskBand;
  priority: MlPriority;
  /** 0–1 model confidence, reduced when attribution coverage is thin. */
  confidence: number;
  /** Largest absolute contributions first. */
  contributions: FeatureContribution[];
  /** Plain-language reason the model ranked this route where it did. */
  rationale: string;
  features: PathFeatures;
  featureSchemaVersion: string;
  modelId: string;
  modelVersion: string;
  /** Which implementation answered — surfaced to the investigator. */
  source: "baseline" | "remote";
  /** Set when a remote model was configured but could not be used. */
  degradedReason?: string;
}

/** A ranked set of candidate routes, highest-scoring first. */
export interface RoutePrediction {
  /** The route the model believes the money took. */
  predicted: PathPrediction | null;
  /** All candidates, ranked by model score. */
  ranked: PathPrediction[];
  modelId: string;
  modelVersion: string;
  featureSchemaVersion: string;
  source: "baseline" | "remote";
  degraded: boolean;
  degradedReason?: string;
  /** Wall-clock milliseconds spent scoring. */
  latencyMs: number;
}

export interface MlProvider {
  readonly id: string;
  readonly version: string;
  readonly source: "baseline" | "remote";
  /** Score a batch of candidate routes. Must not throw for valid input. */
  scorePaths(batch: { routeId: string; addresses: string[]; features: PathFeatures }[]): Promise<
    {
      routeId: string;
      routeScore: number;
      confidence: number;
      contributions: FeatureContribution[];
    }[]
  >;
  healthcheck(): Promise<{ ok: boolean; detail?: string }>;
}

export function bandFor(score: number): MlRiskBand {
  if (score >= 85) return "severe";
  if (score >= 70) return "high";
  if (score >= 50) return "elevated";
  if (score >= 30) return "moderate";
  return "low";
}

export function priorityFor(score: number, terminatesAtVasp: boolean): MlPriority {
  // A high score only becomes "urgent" when there is a regulated counterparty
  // to serve — otherwise there is nothing for an LEA to freeze yet.
  if (score >= 75 && terminatesAtVasp) return "urgent";
  if (score >= 55) return "priority";
  return "routine";
}
