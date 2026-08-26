/**
 * Provider registry.
 *
 * Resolution is explicit and per-chain: GraphSense is used whenever it is
 * configured and indexes the requested chain; otherwise the deterministic
 * synthetic provider serves the request. Nothing else in the codebase needs to
 * know which one answered — the result shape is identical.
 */
import type { Chain } from "../../models/Investigation.model";
import { CHAINS } from "../../models/Investigation.model";
import { createGraphSenseProvider } from "./graphsense.provider";
import { syntheticProvider } from "./synthetic.provider";
import type { ChainProvider } from "./types";

let graphsense: ChainProvider | null | undefined;

/** Lazily constructed so env validation failures surface at first use, not import. */
function graphsenseProvider(): ChainProvider | null {
  if (graphsense === undefined) graphsense = createGraphSenseProvider();
  return graphsense;
}

/** Test seam: inject a provider (or `null`) instead of reading configuration. */
export function setGraphSenseProvider(provider: ChainProvider | null): void {
  graphsense = provider;
}

export function resetProviders(): void {
  graphsense = undefined;
}

export function getChainProvider(chain: Chain): ChainProvider {
  const live = graphsenseProvider();
  if (live && live.supports(chain)) return live;
  return syntheticProvider;
}

export function isLiveProvider(chain: Chain): boolean {
  return getChainProvider(chain).id === "graphsense";
}

/** Per-chain coverage plus a reachability probe, for the status endpoint. */
export async function providerStatus() {
  const live = graphsenseProvider();
  const health = live ? await live.healthcheck() : { ok: false, detail: "Not configured" };

  return {
    graphsense: {
      configured: Boolean(live),
      reachable: health.ok,
      ...(health.detail ? { detail: health.detail } : {}),
      chains: CHAINS.filter((chain) => live?.supports(chain) ?? false),
    },
    fallback: {
      id: syntheticProvider.id,
      label: syntheticProvider.label,
      chains: CHAINS,
    },
    resolution: Object.fromEntries(
      CHAINS.map((chain) => [chain, getChainProvider(chain).id]),
    ) as Record<Chain, ChainProvider["id"]>,
  };
}

export { syntheticProvider };
export * from "./types";
export { expandGraphFromProvider, traceWithProvider } from "./expansion";
