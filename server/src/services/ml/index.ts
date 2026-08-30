/**
 * Money-route prediction pipeline (AI System 1).
 *
 * Candidate paths are enumerated algorithmically from the traced graph; the
 * configured ML provider scores their feature vectors; routes are returned
 * ranked by model score with full per-feature explainability.
 */
import { env } from "../../config/env";
import type { Chain, GraphEdge, GraphNode } from "../../models/Investigation.model";
import { logger } from "../../utils/logger";
import { baselineMlProvider } from "./baseline.provider";
import { enumeratePaths, extractPathFeatures } from "./features";
import { createRemoteMlProvider } from "./remote.provider";
import type { MlProvider, RoutePredictionResult, ScoredRoute } from "./types";

function resolveProvider(): MlProvider {
  if (env.hasRemoteMl && env.TRACIFY_ML_URL) {
    return createRemoteMlProvider(env.TRACIFY_ML_URL, env.TRACIFY_ML_API_KEY, env.TRACIFY_ML_TIMEOUT_MS);
  }
  return baselineMlProvider;
}

function priority(score: number): ScoredRoute["priority"] {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export async function predictMoneyRoutes(input: {
  chain: Chain;
  rootAddress: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  maxRoutes?: number;
}): Promise<RoutePredictionResult> {
  const seedValue = input.nodes.find((n) => n.hop === 0)?.valueUsd ?? 0;
  const rawPaths = enumeratePaths(input.rootAddress, input.edges);
  const byAddress = new Map(input.nodes.map((n) => [n.address, n]));

  const provider = resolveProvider();
  let usedProvider = provider;
  const featureSets = rawPaths.map((p) => extractPathFeatures(p, input.nodes, input.edges, seedValue));

  let scores: Awaited<ReturnType<MlProvider["score"]>>;
  try {
    scores = await provider.score(featureSets);
  } catch (error) {
    logger.warn("remote ML unavailable — degrading to baseline model", {
      reason: error instanceof Error ? error.message : String(error),
    });
    usedProvider = baselineMlProvider;
    scores = await baselineMlProvider.score(featureSets);
  }

  const routes: ScoredRoute[] = rawPaths
    .map((p, i) => {
      const endpoint = p.path[p.path.length - 1] as string;
      const endNode = byAddress.get(endpoint);
      const s = scores[i] as { riskScore: number; contributions: ScoredRoute["contributions"] };
      return {
        path: p.path,
        txHashes: p.txHashes,
        endpoint,
        ...(endNode?.entity || endNode?.label
          ? { endpointEntity: endNode.entity ?? endNode.label }
          : {}),
        endpointIsVasp: Boolean(endNode?.isVasp),
        valueUsd: Math.round(p.valueUsd),
        hops: p.path.length - 1,
        features: featureSets[i] as ScoredRoute["features"],
        riskScore: s.riskScore,
        priority: priority(s.riskScore),
        contributions: s.contributions,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore || b.valueUsd - a.valueUsd)
    .slice(0, input.maxRoutes ?? 10);

  const winning = routes[0] ?? null;
  return {
    rootAddress: input.rootAddress,
    generatedAt: new Date(),
    model: { id: usedProvider.id, kind: usedProvider.kind, version: usedProvider.version },
    winningRoute: winning,
    routes,
    note: winning
      ? `Most likely laundering route: ${winning.path.length} addresses, ${winning.hops} hops, ~$${winning.valueUsd.toLocaleString()} reaching ${winning.endpointEntity ?? "an unattributed endpoint"} (model score ${winning.riskScore}).`
      : "No outbound value path was found within the hop bound.",
  };
}
