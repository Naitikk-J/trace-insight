/**
 * Grounding context builder.
 *
 * The copilot only ever sees this structure — an allow-list of computed facts,
 * already redacted. Nothing is fetched from a chain here and nothing is
 * inferred: if a fact is not in this object, the model has no basis to state it,
 * and the instruction block tells it to say so instead of guessing.
 */
import type { GraphEdge, GraphNode } from "../../models/Investigation.model";
import type { BehaviouralSignal, TracePath } from "../intelligence.service";
import type { RoutePrediction } from "../ml";
import { maskAddress, maskEntity, maskReference } from "./redact";

export interface InvestigationContextInput {
  reference: string;
  title: string;
  chain: string;
  rootAddress: string;
  direction: string;
  status: string;
  riskScore: number;
  dataSource: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: TracePath[];
  signals: BehaviouralSignal[];
  metrics: Record<string, number>;
  prediction?: RoutePrediction | null;
}

export interface GroundedContext {
  json: string;
  /** Keys the answer may cite — recorded in the audit log. */
  groundingKeys: string[];
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Build the redacted, bounded JSON context for one investigation. */
export function buildInvestigationContext(input: InvestigationContextInput): GroundedContext {
  const vasps = input.nodes
    .filter((node) => node.isVasp)
    .sort((a, b) => a.hop - b.hop)
    .slice(0, 8)
    .map((node) => ({
      address: maskAddress(node.address),
      service: maskEntity(node.label ?? node.entity) ?? "unattributed service",
      hop: node.hop,
      valueUsd: Math.round(node.valueUsd),
      attributionRisk: node.riskScore,
    }));

  const context = {
    investigation: {
      reference: maskReference(input.reference),
      title: input.title,
      chain: input.chain,
      rootAddress: maskAddress(input.rootAddress),
      direction: input.direction,
      status: input.status,
      platformRiskScore: input.riskScore,
      chainDataSource: input.dataSource,
    },
    metrics: input.metrics,
    // Deterministic ranking from the graph engine.
    candidateRoutes: input.paths.slice(0, 6).map((path, i) => ({
      rank: i + 1,
      trail: path.addresses.map(maskAddress),
      hops: path.hops,
      valueUsd: path.valueUsd,
      averageAttributionRisk: path.riskScore,
      endsAtRegulatedService: path.terminatesAtVasp,
      graphRationale: path.rationale,
    })),
    // AI System 1 output. Presented as a prediction, never as a fact.
    modelPrediction: input.prediction
      ? {
          modelId: input.prediction.modelId,
          modelVersion: input.prediction.modelVersion,
          degraded: input.prediction.degraded,
          predictedMoneyRoute: input.prediction.predicted
            ? {
                trail: input.prediction.predicted.addresses.map(maskAddress),
                routeScore: input.prediction.predicted.routeScore,
                band: input.prediction.predicted.band,
                priority: input.prediction.predicted.priority,
                confidence: input.prediction.predicted.confidence,
                drivers: input.prediction.predicted.contributions.slice(0, 6).map((c) => ({
                  feature: c.feature,
                  points: c.contribution,
                  meaning: c.note,
                })),
              }
            : null,
          rankedRoutes: input.prediction.ranked.slice(0, 5).map((route) => ({
            trail: route.addresses.map(maskAddress),
            routeScore: route.routeScore,
            band: route.band,
          })),
        }
      : null,
    behaviouralSignals: input.signals.map((signal) => ({
      code: signal.code,
      label: signal.label,
      severity: signal.severity,
      confidence: signal.confidence,
      addresses: signal.addresses.map(maskAddress),
      explanation: signal.explanation,
    })),
    regulatedServiceTouchpoints: vasps,
    graphSummary: {
      addresses: input.nodes.length,
      transfers: input.edges.length,
      deepestHop: input.nodes.reduce((max, node) => Math.max(max, node.hop), 0),
      totalValueObserved: money(input.edges.reduce((acc, edge) => acc + edge.valueUsd, 0)),
    },
  };

  return {
    json: JSON.stringify(context, null, 2),
    groundingKeys: [
      "investigation",
      "metrics",
      "candidateRoutes",
      ...(context.modelPrediction ? ["modelPrediction"] : []),
      "behaviouralSignals",
      "regulatedServiceTouchpoints",
      "graphSummary",
    ],
  };
}
