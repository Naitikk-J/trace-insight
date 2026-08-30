/**
 * Dual-AI orchestration.
 *
 * One place composes the two systems so their roles cannot blur:
 *   AI System 1 (own model)  → ranks candidate money routes, produces scores
 *   AI System 2 (external)   → explains that output in investigator language
 *
 * System 2 receives System 1's result as read-only context. It cannot change a
 * score, add a route, or reach a chain. Every call is authorised through the
 * existing case-scoped access check and written to the audit log.
 */
import { detectSignals, rankPaths } from "./intelligence.service";
import { getInvestigation } from "./investigation.service";
import { askCopilot, type CopilotAnswer, type CopilotMode, type InvestigationContextInput } from "./llm";
import { predictMoneyRoutes, type RoutePrediction } from "./ml";
import { recordAudit } from "./audit.service";
import type { AuthenticatedUser } from "../types/express";

/** Rehydrate an investigation into the shape both AI systems consume. */
async function loadAnalysis(id: string, user: AuthenticatedUser) {
  const investigation = await getInvestigation(id, user);
  const nodes = investigation.graph.nodes;
  const edges = investigation.graph.edges.map((edge) => ({
    ...edge,
    timestamp: new Date(edge.timestamp),
  }));
  const paths = nodes.length > 0 ? rankPaths(nodes, edges, investigation.rootAddress) : [];
  const signals = nodes.length > 0 ? detectSignals(nodes, edges) : [];
  return { investigation, nodes, edges, paths, signals };
}

/**
 * Predict the money route for a stored investigation.
 *
 * Candidates are the graph engine's enumerated address trails — the model only
 * reorders them, so a predicted route always exists on-chain.
 */
export async function predictInvestigationRoutes(
  id: string,
  user: AuthenticatedUser,
): Promise<RoutePrediction & { investigationId: string; reference: string }> {
  const { investigation, nodes, edges, paths } = await loadAnalysis(id, user);

  const prediction = await predictMoneyRoutes(
    nodes,
    edges,
    investigation.rootAddress,
    paths.map((path) => ({ addresses: path.addresses, leafValueUsd: path.valueUsd })),
  );

  await recordAudit({
    actorId: user.id,
    action: "ml.route.predict",
    resource: "investigation",
    resourceId: investigation._id.toString(),
    metadata: {
      model: `${prediction.modelId}@${prediction.modelVersion}`,
      candidates: prediction.ranked.length,
      degraded: prediction.degraded,
    },
  });

  return {
    ...prediction,
    investigationId: investigation._id.toString(),
    reference: investigation.reference,
  };
}

/** Ask the copilot about a stored investigation, grounded in platform output. */
export async function copilotForInvestigation(
  id: string,
  user: AuthenticatedUser,
  input: { mode: CopilotMode; question?: string },
): Promise<CopilotAnswer & { investigationId: string }> {
  const { investigation, nodes, edges, paths, signals } = await loadAnalysis(id, user);

  // System 1 runs first: the copilot explains a prediction, never makes one.
  const prediction = await predictMoneyRoutes(
    nodes,
    edges,
    investigation.rootAddress,
    paths.map((path) => ({ addresses: path.addresses, leafValueUsd: path.valueUsd })),
  );

  const context: InvestigationContextInput = {
    reference: investigation.reference,
    title: investigation.title,
    chain: investigation.chain,
    rootAddress: investigation.rootAddress,
    direction: investigation.direction,
    status: investigation.status,
    riskScore: investigation.riskScore,
    dataSource: investigation.dataSource,
    nodes,
    edges,
    paths,
    signals,
    metrics: { ...investigation.metrics },
    prediction,
  };

  const answer = await askCopilot({
    mode: input.mode,
    ...(input.question ? { question: input.question } : {}),
    context,
  });

  await recordAudit({
    actorId: user.id,
    action: "llm.copilot.ask",
    resource: "investigation",
    resourceId: investigation._id.toString(),
    metadata: {
      mode: input.mode,
      provider: answer.provider,
      model: answer.model,
      dataPolicy: answer.dataPolicy,
      fallback: answer.fallback,
      groundingKeys: answer.groundingKeys.join(","),
    },
  });

  return { ...answer, investigationId: investigation._id.toString() };
}
