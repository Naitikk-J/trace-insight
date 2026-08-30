/**
 * Deterministic feature extraction for route scoring.
 *
 * Every feature is pure arithmetic over the traced graph — fully reproducible
 * and safe to show in an evidentiary context.
 */
import type { GraphEdge, GraphNode } from "../../models/Investigation.model";
import { OBFUSCATION_CATEGORIES } from "../blockchain/types";
import type { PathFeatureVector } from "./types";

export interface RawPath {
  path: string[];
  txHashes: string[];
  valueUsd: number;
}

/** Enumerate value-bearing trails root → sinks via BFS, capped for safety. */
export function enumeratePaths(
  rootAddress: string,
  edges: GraphEdge[],
  maxPaths = 64,
): RawPath[] {
  const outgoing = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.from) ?? [];
    list.push(e);
    outgoing.set(e.from, list);
  }

  const paths: RawPath[] = [];
  const queue: RawPath[] = [{ path: [rootAddress], txHashes: [], valueUsd: 0 }];
  while (queue.length > 0 && paths.length < maxPaths) {
    const current = queue.shift() as RawPath;
    const tail = current.path[current.path.length - 1] as string;
    const next = (outgoing.get(tail) ?? []).filter(
      (e) => !current.path.includes(e.to),
    );
    if (next.length === 0) {
      if (current.path.length > 1) paths.push(current);
      continue;
    }
    for (const e of next) {
      queue.push({
        path: [...current.path, e.to],
        txHashes: [...current.txHashes, e.txHash],
        valueUsd: e.valueUsd,
      });
    }
  }
  return paths;
}

export function extractPathFeatures(
  raw: RawPath,
  nodes: GraphNode[],
  edges: GraphEdge[],
  seedValueUsd: number,
): PathFeatureVector {
  const byAddress = new Map(nodes.map((n) => [n.address, n]));
  const outDegree = new Map<string, number>();
  for (const e of edges) outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);

  const hops = raw.path.length - 1;
  const endValue = raw.valueUsd;
  const retention = seedValueUsd > 0 ? Math.min(1, endValue / seedValueUsd) : 0;

  // Velocity: avg seconds between hops on this trail.
  const times = raw.txHashes
    .map((h) => edges.find((e) => e.txHash === h))
    .filter((e): e is GraphEdge => Boolean(e))
    .map((e) => new Date(e.timestamp).getTime())
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(Math.max(1, ((times[i] as number) - (times[i - 1] as number)) / 1000));
  }
  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 86_400;
  const velocityGap = 1 - Math.min(1, Math.log10(avgGap + 1) / 6); // fast → ~1

  let maxFanOut = 0;
  let branched = 0;
  for (const addr of raw.path) {
    const deg = outDegree.get(addr) ?? 0;
    if (deg > maxFanOut) maxFanOut = deg;
    if (deg > 1) branched += 1;
  }

  const cats = raw.path.map((a) => (byAddress.get(a)?.category ?? "").toLowerCase());
  const obfuscation = cats.some((c) => OBFUSCATION_CATEGORIES.has(c)) ? 1 : 0;
  const bridge = cats.some((c) => c === "bridge" || c === "cross-chain" || c === "cross_chain") ? 1 : 0;

  const endNode = byAddress.get(raw.path[raw.path.length - 1] as string);
  const endIsVasp = Boolean(endNode?.isVasp);
  // Proximity to the nearest VASP reachable from the path tail.
  const vaspHops = nodes.filter((n) => n.isVasp).map((n) => n.hop);
  const nearestVaspHop = endIsVasp
    ? hops
    : vaspHops.length > 0
      ? Math.min(...vaspHops)
      : hops + 4;
  const distance = Math.max(0, nearestVaspHop - hops);

  return {
    valueRetention: round(retention),
    valueMagnitude: round(Math.min(1, Math.log10(endValue + 1) / 7)),
    pathLength: round(Math.min(1, hops / 8)),
    velocityGap: round(velocityGap),
    maxFanOut: round(Math.min(1, maxFanOut / 6)),
    linearity: branched === 0 ? 1 : round(1 - branched / raw.path.length),
    vaspProximity: round(1 / (1 + distance)),
    obfuscationExposure: obfuscation,
    bridgeExposure: bridge,
  };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
