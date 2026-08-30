/**
 * Route-risk gateway — the single entry point for AI System 1.
 *
 * Responsibilities:
 *  - build features from observed graph data (never from model output)
 *  - score every candidate route and rank them
 *  - degrade to the in-process baseline whenever the remote model is absent,
 *    slow, or returns something unusable, and say so in the result
 *
 * Prediction never invents a route: candidates come from the graph engine's
 * enumerated address trails, and the model only reorders them.
 */
import type { GraphEdge, GraphNode } from "../../models/Investigation.model";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { baselineMlProvider } from "./baseline.provider";
import { buildGraphIndex, extractPathFeatures, routeIdFor } from "./features";
import { createRemoteMlProvider } from "./remote.provider";
import {
  FEATURE_SCHEMA_VERSION,
  bandFor,
  priorityFor,
  type MlProvider,
  type PathFeatures,
  type PathPrediction,
  type RoutePrediction,
} from "./types";

let remote: MlProvider | null | undefined;

function remoteProvider(): MlProvider | null {
  if (remote === undefined) remote = createRemoteMlProvider();
  return remote;
}

/** Test seam: inject a provider (or `null`) instead of reading configuration. */
export function setRemoteMlProvider(provider: MlProvider | null): void {
  remote = provider;
}

export function resetMlProviders(): void {
  remote = undefined;
}

/** A candidate route as produced by the graph engine. */
export interface RouteCandidate {
  addresses: string[];
  /** USD value observed at the route's endpoint. */
  leafValueUsd: number;
}

function rationaleFor(prediction: Omit<PathPrediction, "rationale">): string {
  const top = prediction.contributions.slice(0, 3).map((c) => c.note.toLowerCase());
  const endpoint = prediction.features.terminatesAtVasp
    ? "the route ends at a regulated service, so an information or freeze request is actionable"
    : "the route does not yet reach a regulated service, so further expansion is needed before an LEA request";
  const retention = Math.round(prediction.features.valueRetention * 100);
  const reasons = top.length > 0 ? top.join(", ") : "no single dominant driver";
  return `Scored ${prediction.routeScore}/100 (${prediction.band}) across ${Math.max(
    0,
    prediction.addresses.length - 1,
  )} hops retaining ${retention}% of traced value. Leading drivers: ${reasons}. ${
    endpoint.charAt(0).toUpperCase() + endpoint.slice(1)
  }.`;
}

/**
 * Predict which enumerated route the money took.
 *
 * Ordering is the model's output; the routes themselves are chain facts.
 */
export async function predictMoneyRoutes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootAddress: string,
  candidates: RouteCandidate[],
): Promise<RoutePrediction> {
  const startedAt = Date.now();

  const base: RoutePrediction = {
    predicted: null,
    ranked: [],
    modelId: baselineMlProvider.id,
    modelVersion: baselineMlProvider.version,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    source: "baseline",
    degraded: false,
    latencyMs: 0,
  };

  const usable = candidates.filter((candidate) => candidate.addresses.length >= 2);
  if (usable.length === 0) {
    return { ...base, latencyMs: Date.now() - startedAt };
  }

  const index = buildGraphIndex(nodes, edges, rootAddress);
  const batch = usable.map((candidate) => {
    const features: PathFeatures = extractPathFeatures(
      candidate.addresses,
      index,
      candidate.leafValueUsd,
    );
    return { routeId: routeIdFor(candidate.addresses), addresses: candidate.addresses, features };
  });

  let provider: MlProvider = baselineMlProvider;
  let degradedReason: string | undefined;
  let scored: Awaited<ReturnType<MlProvider["scorePaths"]>>;

  const live = remoteProvider();
  if (live) {
    try {
      scored = await live.scorePaths(batch);
      provider = live;
    } catch (error) {
      degradedReason =
        error instanceof Error ? error.message : "Remote model returned an unusable response";
      logger.warn("Route-risk model degraded to baseline", { reason: degradedReason });
      scored = await baselineMlProvider.scorePaths(batch);
    }
  } else {
    scored = await baselineMlProvider.scorePaths(batch);
  }

  const scoreByRoute = new Map(scored.map((item) => [item.routeId, item]));

  const ranked: PathPrediction[] = batch
    .map((item) => {
      const result = scoreByRoute.get(item.routeId);
      const routeScore = result?.routeScore ?? 0;
      const partial: Omit<PathPrediction, "rationale"> = {
        routeId: item.routeId,
        addresses: item.addresses,
        routeScore,
        band: bandFor(routeScore),
        priority: priorityFor(routeScore, item.features.terminatesAtVasp === 1),
        confidence: result?.confidence ?? 0.35,
        contributions: result?.contributions ?? [],
        features: item.features,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        modelId: provider.id,
        modelVersion: provider.version,
        source: provider.source,
        ...(degradedReason ? { degradedReason } : {}),
      };
      return { ...partial, rationale: rationaleFor(partial) };
    })
    .sort((a, b) => b.routeScore - a.routeScore || b.confidence - a.confidence);

  return {
    predicted: ranked[0] ?? null,
    ranked,
    modelId: provider.id,
    modelVersion: provider.version,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    source: provider.source,
    degraded: Boolean(degradedReason),
    ...(degradedReason ? { degradedReason } : {}),
    latencyMs: Date.now() - startedAt,
  };
}

/** Configuration and reachability of the route-risk model, for the status API. */
export async function mlStatus() {
  const live = remoteProvider();
  const health = live
    ? await live.healthcheck()
    : { ok: true, detail: "Remote model not configured — baseline model in use" };

  return {
    mode: env.ML_PROVIDER,
    active: live && health.ok ? "remote" : "baseline",
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    baseline: {
      id: baselineMlProvider.id,
      version: baselineMlProvider.version,
      explainable: true,
    },
    remote: {
      configured: Boolean(live),
      reachable: live ? health.ok : false,
      version: live ? live.version : null,
      ...(health.detail ? { detail: health.detail } : {}),
    },
    demoMode: env.DEMO_MODE,
  };
}

export * from "./types";
export { buildGraphIndex, extractPathFeatures, routeIdFor, toFeatureVector } from "./features";
export { baselineMlProvider };
