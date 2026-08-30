/**
 * TRACIFY AI System 1 — money-route prediction (own ML model).
 *
 * The model never invents a route. Candidate paths are generated
 * algorithmically (bounded BFS over the traced graph); the model scores a
 * fixed, versioned numeric feature vector per path and ranks them.
 */

export interface PathFeatureVector {
  /** Fraction of seed value still present at path end (0–1). */
  valueRetention: number;
  /** Log-scaled absolute value magnitude at path end. */
  valueMagnitude: number;
  /** Hops from the reported wallet to path end. */
  pathLength: number;
  /** Avg seconds between consecutive hops, log-scaled (lower = faster). */
  velocityGap: number;
  /** Max sibling fan-out along the path (splitting behaviour). */
  maxFanOut: number;
  /** 1 when the path is a straight chain with no branching. */
  linearity: number;
  /** 1 / hops-to-nearest-VASP on this path (1 when it ends at a VASP). */
  vaspProximity: number;
  /** 1 when any hop touches a mixer/privacy service. */
  obfuscationExposure: number;
  /** 1 when any hop touches a cross-chain bridge. */
  bridgeExposure: number;
}

export const FEATURE_KEYS = [
  "valueRetention",
  "valueMagnitude",
  "pathLength",
  "velocityGap",
  "maxFanOut",
  "linearity",
  "vaspProximity",
  "obfuscationExposure",
  "bridgeExposure",
] as const satisfies readonly (keyof PathFeatureVector)[];

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface ScoredRoute {
  /** Full address trail root → endpoint. */
  path: string[];
  txHashes: string[];
  endpoint: string;
  endpointEntity?: string;
  endpointIsVasp: boolean;
  valueUsd: number;
  hops: number;
  features: PathFeatureVector;
  /** Model output, 0–1. */
  riskScore: number;
  priority: "critical" | "high" | "medium" | "low";
  /** Signed per-feature contribution to the score (explainability). */
  contributions: { feature: FeatureKey; weight: number; value: number; contribution: number }[];
}

export interface RoutePredictionResult {
  rootAddress: string;
  generatedAt: Date;
  model: { id: string; kind: "baseline" | "remote"; version: string };
  winningRoute: ScoredRoute | null;
  routes: ScoredRoute[];
  note: string;
}

export interface MlProvider {
  id: string;
  kind: "baseline" | "remote";
  version: string;
  score(features: PathFeatureVector[]): Promise<
    { riskScore: number; contributions: ScoredRoute["contributions"] }[]
  >;
}
