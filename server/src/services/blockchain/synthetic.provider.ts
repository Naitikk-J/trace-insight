/**
 * Synthetic provider.
 *
 * Deterministic stand-in used when GraphSense is not configured (local
 * development, CI, demos). It is built on the pure intelligence engine, so the
 * same address always yields the same neighbourhood and no network call is made.
 */
import type { Chain } from "../../models/Investigation.model";
import { expandGraph } from "../intelligence.service";
import {
  isServiceCategory,
  type AddressNeighbour,
  type AddressSummary,
  type AddressTag,
  type ChainProvider,
  type NeighbourQuery,
} from "./types";

function tagsFor(category: string | undefined, label: string | undefined): AddressTag[] {
  if (!category && !label) return [];
  return [
    {
      label: label ?? category ?? "unlabelled",
      ...(category ? { category } : {}),
      confidence: 0.6,
      source: "synthetic",
    },
  ];
}

export class SyntheticProvider implements ChainProvider {
  readonly id = "synthetic" as const;
  readonly label = "Synthetic ledger (deterministic)";

  supports(): boolean {
    return true;
  }

  /** One hop of the deterministic graph describes the address' neighbourhood. */
  private hop(chain: Chain, address: string) {
    return expandGraph({
      rootAddress: address,
      chain,
      maxHops: 1,
      minValueUsd: 0,
      direction: "outbound",
    });
  }

  async getAddress(chain: Chain, address: string): Promise<AddressSummary> {
    const { nodes, edges } = this.hop(chain, address);
    const root = nodes[0]!;
    const outgoing = edges.filter((e) => e.from === address);

    return {
      address,
      chain,
      ...(root.label ? { label: root.label } : {}),
      ...(root.category ? { category: root.category } : {}),
      isVasp: root.isVasp,
      balanceUsd: root.valueUsd,
      totalSentUsd: outgoing.reduce((acc, e) => acc + e.valueUsd, 0),
      outgoingTxCount: outgoing.length,
      outDegree: outgoing.length,
      ...(edges[0] ? { firstSeen: edges[0].timestamp, lastSeen: edges[edges.length - 1]!.timestamp } : {}),
      tags: tagsFor(root.category, root.label),
    };
  }

  async getNeighbours(query: NeighbourQuery): Promise<AddressNeighbour[]> {
    const { nodes, edges } = this.hop(query.chain, query.address);
    const byAddress = new Map(nodes.map((n) => [n.address, n]));

    return edges
      .filter((edge) => (query.direction === "out" ? edge.from : edge.to) === query.address)
      .map((edge) => {
        const other = query.direction === "out" ? edge.to : edge.from;
        const node = byAddress.get(other);
        const category = node?.category;
        return {
          address: other,
          chain: query.chain,
          ...(node?.label ? { label: node.label } : {}),
          ...(node?.entity ? { entity: node.entity } : {}),
          ...(category ? { category } : {}),
          isVasp: node?.isVasp ?? isServiceCategory(category),
          valueUsd: edge.valueUsd,
          amount: edge.amount,
          asset: edge.asset,
          txCount: 1,
          txHash: edge.txHash,
          timestamp: edge.timestamp,
          tags: tagsFor(category, node?.label),
        } satisfies AddressNeighbour;
      })
      .filter((n) => query.minValueUsd === undefined || n.valueUsd >= query.minValueUsd)
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, query.limit);
  }

  async getTags(chain: Chain, address: string): Promise<AddressTag[]> {
    return (await this.getAddress(chain, address)).tags;
  }

  async healthcheck(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

export const syntheticProvider = new SyntheticProvider();
