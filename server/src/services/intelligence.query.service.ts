/**
 * Read-only chain intelligence lookups.
 *
 * These power the workspace's address inspector: a single address summary with
 * attribution tags, and its ranked counterparties. They are provider-backed,
 * so the same endpoints serve GraphSense data in production and deterministic
 * data locally.
 */
import type { Chain } from "../models/Investigation.model";
import { getChainProvider } from "./blockchain";
import { baselineRisk } from "./blockchain/types";

export async function lookupAddress(chain: Chain, address: string) {
  const provider = getChainProvider(chain);
  const summary = await provider.getAddress(chain, address);

  return {
    source: provider.id,
    sourceLabel: provider.label,
    address: summary,
    riskScore: baselineRisk(summary.category, 0),
    /** Attribution is the actionable part: surface it explicitly. */
    attribution: {
      isVasp: summary.isVasp,
      topLabel: summary.label ?? null,
      tagCount: summary.tags.length,
    },
  };
}

export async function lookupNeighbours(
  chain: Chain,
  address: string,
  options: { direction: "in" | "out"; limit: number; minValueUsd?: number },
) {
  const provider = getChainProvider(chain);
  const neighbours = await provider.getNeighbours({
    chain,
    address,
    direction: options.direction,
    limit: options.limit,
    ...(options.minValueUsd !== undefined ? { minValueUsd: options.minValueUsd } : {}),
  });

  return {
    source: provider.id,
    sourceLabel: provider.label,
    address,
    direction: options.direction,
    neighbours,
    totalValueUsd: Math.round(neighbours.reduce((acc, n) => acc + n.valueUsd, 0)),
  };
}
