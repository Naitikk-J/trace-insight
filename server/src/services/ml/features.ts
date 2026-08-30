/**
 * Feature extraction: observed graph → numeric vector.
 *
 * This is the only place chain data is turned into model input, so the
 * definition of every feature lives next to its computation. Extraction is
 * pure and deterministic: the same graph always produces the same vector,
 * which is what makes a prediction reproducible in an evidence pack.
 */
import { createHash } from "node:crypto";
import type { GraphEdge, GraphNode } from "../../models/Investigation.model";
import { ILLICIT_CATEGORIES, OBFUSCATION_CATEGORIES } from "../blockchain/types";
import { FEATURE_ORDER, type PathFeatures } from "./types";

const BURST_WINDOW_MS = 30 * 60_000;
const HOP_REFERENCE = 8;
const DEGREE_REFERENCE = 8;
const VALUE_REFERENCE_USD = 1_000_000;
const BRIDGE_CATEGORIES = new Set(["bridge", "cross_chain_bridge", "cross chain bridge"]);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Stable identifier for a route, independent of scoring order. */
export function routeIdFor(addresses: string[]): string {
  return createHash("sha256").update(addresses.join(">")).digest("hex").slice(0, 16);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Degree maps computed once per graph and reused across every candidate route. */
export interface GraphIndex {
  nodeByAddress: Map<string, GraphNode>;
  outDegree: Map<string, number>;
  inDegree: Map<string, number>;
  edgeByPair: Map<string, GraphEdge>;
  seedValueUsd: number;
  /** Hop distance from each address to the nearest VASP reachable downstream. */
  vaspDistance: Map<string, number>;
}

export function buildGraphIndex(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootAddress: string,
): GraphIndex {
  const nodeByAddress = new Map(nodes.map((n) => [n.address, n]));
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const edgeByPair = new Map<string, GraphEdge>();

  for (const edge of edges) {
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    const key = `${edge.from}>${edge.to}`;
    // Keep the largest transfer between a pair as the representative edge.
    const existing = edgeByPair.get(key);
    if (!existing || edge.valueUsd > existing.valueUsd) edgeByPair.set(key, edge);
  }

  // Reverse BFS from every VASP gives each address its downstream VASP distance.
  const reverse = new Map<string, string[]>();
  for (const edge of edges) {
    const list = reverse.get(edge.to) ?? [];
    list.push(edge.from);
    reverse.set(edge.to, list);
  }
  const vaspDistance = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if (node.isVasp) {
      vaspDistance.set(node.address, 0);
      queue.push(node.address);
    }
  }
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (current === undefined) continue;
    const distance = vaspDistance.get(current) ?? 0;
    for (const parent of reverse.get(current) ?? []) {
      if (vaspDistance.has(parent)) continue;
      vaspDistance.set(parent, distance + 1);
      queue.push(parent);
    }
  }

  return {
    nodeByAddress,
    outDegree,
    inDegree,
    edgeByPair,
    seedValueUsd: nodeByAddress.get(rootAddress)?.valueUsd ?? nodes[0]?.valueUsd ?? 0,
    vaspDistance,
  };
}

function categoryOf(node: GraphNode | undefined): string {
  return (node?.category ?? "").toLowerCase();
}

/**
 * Extract the versioned feature vector for one candidate route.
 *
 * `addresses` is the ordered address trail produced by the graph engine — the
 * model only ever scores routes the chain data actually contains.
 */
export function extractPathFeatures(
  addresses: string[],
  index: GraphIndex,
  leafValueUsd: number,
): PathFeatures {
  const nodes = addresses
    .map((address) => index.nodeByAddress.get(address))
    .filter((node): node is GraphNode => Boolean(node));
  const count = Math.max(1, nodes.length);
  const hops = Math.max(0, addresses.length - 1);

  const edges: GraphEdge[] = [];
  for (let i = 0; i < addresses.length - 1; i += 1) {
    const edge = index.edgeByPair.get(`${addresses[i]}>${addresses[i + 1]}`);
    if (edge) edges.push(edge);
  }

  // Temporal shape of the route.
  const timestamps = edges
    .map((edge) => new Date(edge.timestamp).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const gapsMinutes: number[] = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    gapsMinutes.push(((timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0)) / 60_000);
  }
  const medianGap = median(gapsMinutes);
  // 1 = consecutive hops within a minute, decaying to 0 across a 24h gap.
  const velocity = gapsMinutes.length === 0 ? 0 : clamp01(1 - medianGap / 1_440);
  const burstHops =
    gapsMinutes.length === 0
      ? 0
      : gapsMinutes.filter((gap) => gap * 60_000 <= BURST_WINDOW_MS).length / gapsMinutes.length;

  // Structural shape.
  const meanOut =
    addresses.reduce((acc, address) => acc + (index.outDegree.get(address) ?? 0), 0) / count;
  const meanIn =
    addresses.reduce((acc, address) => acc + (index.inDegree.get(address) ?? 0), 0) / count;

  let longestLinear = 0;
  let run = 0;
  for (const address of addresses) {
    const isPeel =
      (index.inDegree.get(address) ?? 0) <= 1 && (index.outDegree.get(address) ?? 0) <= 1;
    run = isPeel ? run + 1 : 0;
    longestLinear = Math.max(longestLinear, run);
  }

  // Attribution shape.
  const mixerHits = nodes.filter((node) => OBFUSCATION_CATEGORIES.has(categoryOf(node))).length;
  const bridgeHits = nodes.filter((node) => BRIDGE_CATEGORIES.has(categoryOf(node))).length;
  const illicitHits = nodes.filter((node) => ILLICIT_CATEGORIES.has(categoryOf(node))).length;
  const attributed = nodes.filter((node) => Boolean(node.label ?? node.entity ?? node.category));
  const leaf = nodes[nodes.length - 1];

  const vaspDistances = addresses
    .map((address) => index.vaspDistance.get(address))
    .filter((distance): distance is number => distance !== undefined);
  const nearestVasp = vaspDistances.length > 0 ? Math.min(...vaspDistances) : Infinity;

  const meanEdgeValue =
    edges.length > 0 ? edges.reduce((acc, edge) => acc + edge.valueUsd, 0) / edges.length : 0;

  return {
    hopDepth: round4(clamp01(hops / HOP_REFERENCE)),
    valueRetention: round4(
      clamp01(index.seedValueUsd > 0 ? leafValueUsd / index.seedValueUsd : 0),
    ),
    valueMagnitude: round4(
      clamp01(meanEdgeValue > 0 ? Math.log10(1 + meanEdgeValue) / Math.log10(VALUE_REFERENCE_USD) : 0),
    ),
    velocity: round4(velocity),
    burstiness: round4(clamp01(burstHops)),
    fanOut: round4(clamp01(meanOut / DEGREE_REFERENCE)),
    fanIn: round4(clamp01(meanIn / DEGREE_REFERENCE)),
    chainLinearity: round4(clamp01(longestLinear / Math.max(1, addresses.length))),
    mixerExposure: mixerHits > 0 ? 1 : 0,
    bridgeExposure: bridgeHits > 0 ? 1 : 0,
    illicitExposure: round4(clamp01(illicitHits / count)),
    attributionRisk: round4(
      clamp01(nodes.reduce((acc, node) => acc + (node.riskScore ?? 0), 0) / count / 100),
    ),
    terminatesAtVasp: leaf?.isVasp ? 1 : 0,
    vaspProximity: round4(Number.isFinite(nearestVasp) ? 1 / (1 + nearestVasp) : 0),
    contractShare: 0,
    attributionCoverage: round4(clamp01(attributed.length / count)),
  };
}

/** Dense vector in schema order — the wire format for a remote model. */
export function toFeatureVector(features: PathFeatures): number[] {
  return FEATURE_ORDER.map((key) => features[key]);
}
