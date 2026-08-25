/**
 * Intelligence service layer — abstraction boundary.
 *
 * Every interface below is what the UI consumes. The current implementations are
 * deterministic mocks derived from the investigation record, so real providers
 * (Etherscan/Alchemy adapters, a graph engine, an entity-resolution service, a
 * risk model) can be dropped in behind the same contracts without touching UI
 * code.
 *
 *   BlockchainProvider      -> raw chain reads + normalisation
 *   GraphService            -> bounded investigation graph construction
 *   PathAnalysisService     -> value-continuity path ranking
 *   EntityResolutionService -> wallet -> entity / VASP candidate ranking
 *   RiskAnalysisService     -> behavioural pattern characterisation
 */

import type { InvestigationRecord, Severity } from "@/lib/domain";

/* ---------------- Contracts ---------------- */

export type NodeKind =
  | "target"
  | "wallet"
  | "intermediary"
  | "candidate_entity"
  | "vasp"
  | "bridge";

export interface GraphNode {
  id: string;
  address: string;
  label: string;
  kind: NodeKind;
  hop: number;
  x: number;
  y: number;
  valueIn: string;
  valueOut: string;
  connectedAddresses: number;
  relevantPaths: number;
  firstSeen: string;
  riskNote?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  txHash: string;
  value: string;
  asset: string;
  timestamp: string;
  continuity: number;
  pathIds: string[];
}

export interface InvestigationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds: { hops: number; maxNodes: number };
}

export interface TracePath {
  id: string;
  label: string;
  nodeIds: string[];
  continuity: number;
  valuePreserved: string;
  hops: number;
  endpointKind: NodeKind;
  verdict: string;
  confidence: number;
}

export interface EntityCandidate {
  id: string;
  name: string;
  type: string;
  networks: string[];
  proximityHops: number;
  attributionStrength: number;
  sourceFreshness: string;
  associatedAddresses: number;
  evidenceSources: number;
  rationale: string[];
}

export interface BehaviourSignal {
  id: string;
  pattern: string;
  description: string;
  severity: Severity;
  observedAt: string;
  nodeIds: string[];
}

export interface TimelineEvent {
  id: string;
  at: string;
  clock: string;
  title: string;
  detail: string;
  nodeId?: string;
  pathId?: string;
  kind: "transfer" | "split" | "merge" | "attribution" | "flag";
}

export interface BlockchainProvider {
  readonly id: string;
  supports(chain: string): boolean;
  /** Fetch + normalise activity for an address. Mocked for now. */
  fetchAddressActivity(
    chain: string,
    address: string,
  ): Promise<{ transactions: number; firstSeen: string; lastSeen: string }>;
}

export interface GraphService {
  build(investigation: InvestigationRecord): InvestigationGraph;
}

export interface PathAnalysisService {
  rank(graph: InvestigationGraph): TracePath[];
}

export interface EntityResolutionService {
  candidates(graph: InvestigationGraph): EntityCandidate[];
}

export interface RiskAnalysisService {
  signals(graph: InvestigationGraph): BehaviourSignal[];
}

/* ---------------- Mock implementations ---------------- */

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pseudoAddress(seed: string) {
  const h = hash(seed).toString(16).padStart(8, "0");
  const h2 = hash(seed + "x").toString(16).padStart(8, "0");
  const h3 = hash(seed + "y").toString(16).padStart(8, "0");
  const h4 = hash(seed + "z").toString(16).padStart(8, "0");
  const h5 = hash(seed + "w").toString(16).padStart(8, "0");
  return `0x${(h + h2 + h3 + h4 + h5).slice(0, 40)}`;
}

export const mockBlockchainProvider: BlockchainProvider = {
  id: "mock-evm-provider",
  supports: (chain) =>
    ["ethereum", "polygon", "bsc", "arbitrum"].includes(chain),
  async fetchAddressActivity(chain, address) {
    const h = hash(chain + address);
    return {
      transactions: 20 + (h % 180),
      firstSeen: `${4 + (h % 40)} days ago`,
      lastSeen: `${1 + (h % 6)} days ago`,
    };
  },
};

const HOP_X = [60, 260, 470, 680, 890] as const;

export const mockGraphService: GraphService = {
  build(investigation) {
    const seed = investigation.id + investigation.target_address;
    const depth = Math.min(Math.max(investigation.trace_depth, 2), 4);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    nodes.push({
      id: "n0",
      address: investigation.target_address,
      label: "Target wallet",
      kind: "target",
      hop: 0,
      x: HOP_X[0],
      y: 200,
      valueIn: "318,940 USDT",
      valueOut: "316,420 USDT",
      connectedAddresses: 17,
      relevantPaths: 6,
      firstSeen: "23 days ago",
      riskNote: "Consolidation point for 17 victim complaints.",
    });

    // Branch layout: two primary branches, fanning out per hop.
    const branchSizes = [2, 3, 2, 2];
    let previousLayer = ["n0"];

    for (let hop = 1; hop <= depth; hop++) {
      const count = branchSizes[hop - 1] ?? 2;
      const layer: string[] = [];
      const spacing = 360 / (count + 1);

      for (let i = 0; i < count; i++) {
        const id = `n${hop}_${i}`;
        const h = hash(seed + id);
        const isLast = hop === depth;
        const kind: NodeKind = isLast
          ? i === 0
            ? "vasp"
            : i === 1
              ? "candidate_entity"
              : "wallet"
          : h % 7 === 0
            ? "bridge"
            : "intermediary";

        layer.push(id);
        nodes.push({
          id,
          address: pseudoAddress(seed + id),
          label:
            kind === "vasp"
              ? "Exchange deposit cluster"
              : kind === "candidate_entity"
                ? "Potential entity"
                : kind === "bridge"
                  ? "Bridge contract"
                  : `Intermediary wallet ${String.fromCharCode(65 + i)}`,
          kind,
          hop,
          x: HOP_X[hop] ?? 890,
          y: 40 + spacing * (i + 1),
          valueIn: `${(210 - hop * 38 - i * 22).toFixed(1)}k USDT`,
          valueOut: `${(204 - hop * 38 - i * 24).toFixed(1)}k USDT`,
          connectedAddresses: 3 + (h % 22),
          relevantPaths: 1 + (h % 3),
          firstSeen: `${1 + (h % 20)} days ago`,
          riskNote:
            kind === "bridge"
              ? "Cross-chain bridge — continuation requires destination-chain ingestion."
              : kind === "vasp"
                ? "Address appears in a public exchange deposit attribution set."
                : undefined,
        } as GraphNode);
      }

      previousLayer.forEach((parent, pi) => {
        layer.forEach((child, ci) => {
          if ((pi + ci) % 2 === 1 && layer.length > 1) return;
          const h = hash(seed + parent + child);
          edges.push({
            id: `${parent}->${child}`,
            from: parent,
            to: child,
            txHash: `0x${hash(seed + parent + child).toString(16).padStart(8, "0")}${hash(child + parent).toString(16).padStart(8, "0")}`,
            value: `${(180 - hop * 34 - ci * 18).toFixed(1)}k USDT`,
            asset: "USDT",
            timestamp: `Day ${hop} · ${String(11 + hop).padStart(2, "0")}:${String(10 + (h % 48)).padStart(2, "0")}`,
            continuity: Math.max(0.28, 0.95 - hop * 0.12 - ci * 0.14),
            pathIds: ci === 0 ? ["PATH-A"] : ci === 1 ? ["PATH-B"] : ["PATH-C"],
          });
        });
      });

      previousLayer = layer;
    }

    return { nodes, edges, bounds: { hops: depth, maxNodes: 250 } };
  },
};

export const mockPathAnalysisService: PathAnalysisService = {
  rank(graph) {
    const endpoints = graph.nodes.filter(
      (n) => n.hop === graph.bounds.hops,
    );
    return endpoints.slice(0, 3).map((endpoint, index) => {
      const chain = ["n0"];
      for (let hop = 1; hop <= graph.bounds.hops; hop++) {
        const candidate =
          graph.nodes.find(
            (n) => n.hop === hop && n.id.endsWith(`_${Math.min(index, 1)}`),
          ) ?? graph.nodes.find((n) => n.hop === hop);
        if (candidate) chain.push(candidate.id);
      }
      chain[chain.length - 1] = endpoint.id;
      const continuity = [0.87, 0.42, 0.31][index] ?? 0.3;
      return {
        id: ["PATH-A", "PATH-B", "PATH-C"][index] ?? `PATH-${index}`,
        label:
          ["Primary hypothesis", "Secondary branch", "Alternative branch"][
            index
          ] ?? "Branch",
        nodeIds: chain,
        continuity,
        valuePreserved: `${(continuity * 318.9).toFixed(1)}k USDT`,
        hops: graph.bounds.hops,
        endpointKind: endpoint.kind,
        verdict:
          continuity > 0.7
            ? "Strong value continuity terminating at an attributed endpoint."
            : continuity > 0.4
              ? "Partial continuity. Fragmentation reduces confidence."
              : "Low continuity — consistent with decoy or dust activity.",
        confidence: Math.round(continuity * 96),
      };
    });
  },
};

export const mockEntityResolutionService: EntityResolutionService = {
  candidates(graph) {
    const vasp = graph.nodes.find((n) => n.kind === "vasp");
    const other = graph.nodes.find((n) => n.kind === "candidate_entity");
    const list: EntityCandidate[] = [];
    if (vasp) {
      list.push({
        id: "ent-1",
        name: "Tier 1 exchange deposit cluster",
        type: "Virtual Asset Service Provider",
        networks: ["Ethereum", "Polygon"],
        proximityHops: vasp.hop,
        attributionStrength: 0.84,
        sourceFreshness: "verified 14 days ago",
        associatedAddresses: 2148,
        evidenceSources: 3,
        rationale: [
          "Endpoint address present in a public exchange deposit attribution set",
          "High value continuity preserved along the primary path",
          "Short temporal gaps between hops (under 12 minutes)",
        ],
      });
    }
    if (other) {
      list.push({
        id: "ent-2",
        name: "Unattributed high-activity service",
        type: "Candidate entity",
        networks: ["Ethereum"],
        proximityHops: other.hop,
        attributionStrength: 0.41,
        sourceFreshness: "no direct attribution record",
        associatedAddresses: 96,
        evidenceSources: 1,
        rationale: [
          "Behaviour consistent with a pooled service wallet",
          "No attribution record; inference is behavioural only",
        ],
      });
    }
    const bridge = graph.nodes.find((n) => n.kind === "bridge");
    if (bridge) {
      list.push({
        id: "ent-3",
        name: "Cross-chain bridge contract",
        type: "Infrastructure",
        networks: ["Ethereum", "Arbitrum One"],
        proximityHops: bridge.hop,
        attributionStrength: 0.72,
        sourceFreshness: "contract-level attribution",
        associatedAddresses: 1,
        evidenceSources: 2,
        rationale: [
          "Known bridge contract interface",
          "Continuation beyond this hop requires destination-chain ingestion",
        ],
      });
    }
    return list;
  },
};

export const mockRiskAnalysisService: RiskAnalysisService = {
  signals(graph) {
    const signals: BehaviourSignal[] = [];
    const hop1 = graph.nodes.filter((n) => n.hop === 1).map((n) => n.id);
    const hop2 = graph.nodes.filter((n) => n.hop === 2).map((n) => n.id);

    signals.push({
      id: "sig-1",
      pattern: "Rapid multi-hop movement",
      description:
        "Traced value moved across three hops within 41 minutes of the final victim deposit.",
      severity: "high",
      observedAt: "Day 1 · 12:42 – 13:23",
      nodeIds: ["n0", ...hop1],
    });
    if (hop2.length > 1) {
      signals.push({
        id: "sig-2",
        pattern: "Fan-out fragmentation",
        description:
          "One branch split into multiple low-value outputs averaging 0.4% of the parent transaction.",
        severity: "medium",
        observedAt: "Day 1 · 13:07",
        nodeIds: hop2,
      });
    }
    signals.push({
      id: "sig-3",
      pattern: "Short holding period",
      description:
        "Intermediary wallets held funds for an average of 6 minutes before onward transfer.",
      severity: "medium",
      observedAt: "Day 1 – Day 2",
      nodeIds: hop1,
    });
    if (graph.nodes.some((n) => n.kind === "bridge")) {
      signals.push({
        id: "sig-4",
        pattern: "Bridge interaction",
        description:
          "A dominant branch reaches a cross-chain bridge; on-chain continuity ends at this boundary.",
        severity: "critical",
        observedAt: "Day 2 · 09:14",
        nodeIds: graph.nodes.filter((n) => n.kind === "bridge").map((n) => n.id),
      });
    }
    return signals;
  },
};

export function buildTimeline(graph: InvestigationGraph): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "tl-0",
      at: "Day 1",
      clock: "12:31",
      title: "Final victim deposit received",
      detail: "Target wallet reaches peak balance of 318,940 USDT.",
      nodeId: "n0",
      kind: "transfer",
    },
  ];

  graph.edges.slice(0, 8).forEach((edge, i) => {
    const target = graph.nodes.find((n) => n.id === edge.to);
    events.push({
      id: `tl-${i + 1}`,
      at: edge.timestamp.split(" · ")[0] ?? "Day 1",
      clock: edge.timestamp.split(" · ")[1] ?? "—",
      title:
        target?.kind === "vasp"
          ? "Traced value reaches attributed endpoint"
          : target?.kind === "bridge"
            ? "Branch interacts with bridge contract"
            : `Value moved to ${target?.label ?? "wallet"}`,
      detail: `${edge.value} · continuity ${(edge.continuity * 100).toFixed(0)}%`,
      nodeId: edge.to,
      pathId: edge.pathIds[0],
      kind:
        target?.kind === "vasp"
          ? "attribution"
          : edge.continuity < 0.5
            ? "split"
            : "transfer",
    });
  });

  return events;
}

/** Single place the UI resolves services from — swap bindings here. */
export const intelligence = {
  provider: mockBlockchainProvider,
  graph: mockGraphService,
  paths: mockPathAnalysisService,
  entities: mockEntityResolutionService,
  risk: mockRiskAnalysisService,
  timeline: buildTimeline,
};
