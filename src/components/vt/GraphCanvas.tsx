import { useMemo } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/domain";
import type {
  GraphEdge,
  GraphNode,
  InvestigationGraph,
  NodeKind,
  TracePath,
} from "@/services/intelligence";

const KIND_STYLE: Record<NodeKind, { fill: string; stroke: string }> = {
  target: { fill: "var(--critical)", stroke: "var(--critical)" },
  wallet: { fill: "var(--elevated)", stroke: "var(--border-strong)" },
  intermediary: { fill: "var(--elevated)", stroke: "var(--border-strong)" },
  candidate_entity: { fill: "var(--elevated)", stroke: "var(--warning)" },
  vasp: { fill: "var(--elevated)", stroke: "var(--positive)" },
  bridge: { fill: "var(--elevated)", stroke: "var(--intel)" },
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  target: "Target wallet",
  wallet: "Wallet",
  intermediary: "Intermediary",
  candidate_entity: "Candidate entity",
  vasp: "Attributed VASP",
  bridge: "Bridge contract",
};

/**
 * Presentational canvas for the bounded investigation graph.
 * Layout comes from the graph service; this component only renders + selects.
 */
export function GraphCanvas({
  graph,
  paths,
  focusedPath,
  selectedId,
  onSelectNode,
  onSelectEdge,
}: {
  graph: InvestigationGraph;
  paths: TracePath[];
  focusedPath: string | null;
  selectedId: string | null;
  onSelectNode: (node: GraphNode) => void;
  onSelectEdge: (edge: GraphEdge) => void;
}) {
  const focusedNodeIds = useMemo(() => {
    if (!focusedPath) return null;
    const path = paths.find((p) => p.id === focusedPath);
    return path ? new Set(path.nodeIds) : null;
  }, [focusedPath, paths]);

  const dim = (id: string) => Boolean(focusedNodeIds && !focusedNodeIds.has(id));

  return (
    <div className="canvas-grid relative h-[480px] w-full overflow-hidden rounded-lg border border-border bg-workspace">
      <svg
        viewBox="0 0 1000 420"
        className="h-full w-full"
        role="img"
        aria-label="Bounded investigation graph of traced fund movement"
      >
        <defs>
          <marker
            id="vt-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        {/* Hop guide rails */}
        {Array.from({ length: graph.bounds.hops + 1 }).map((_, hop) => {
          const node = graph.nodes.find((n) => n.hop === hop);
          if (!node) return null;
          return (
            <g key={`hop-${hop}`}>
              <line
                x1={node.x}
                y1={16}
                x2={node.x}
                y2={404}
                stroke="var(--border)"
                strokeDasharray="2 6"
              />
              <text
                x={node.x}
                y={12}
                textAnchor="middle"
                className="mono"
                fontSize="9"
                fill="var(--muted-foreground)"
              >
                {hop === 0 ? "TARGET" : `HOP ${hop}`}
              </text>
            </g>
          );
        })}

        {/* Edges */}
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((n) => n.id === edge.from);
          const to = graph.nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          const faded = dim(from.id) || dim(to.id);
          const mid = (from.x + to.x) / 2;
          return (
            <g
              key={edge.id}
              className="cursor-pointer"
              opacity={faded ? 0.16 : 1}
              onClick={() => onSelectEdge(edge)}
            >
              <path
                d={`M ${from.x + 26} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 28} ${to.y}`}
                fill="none"
                stroke={
                  edge.continuity > 0.7
                    ? "var(--positive)"
                    : edge.continuity > 0.45
                      ? "var(--warning)"
                      : "var(--border-strong)"
                }
                strokeWidth={1 + edge.continuity * 2.4}
                markerEnd="url(#vt-arrow)"
              />
              <text
                x={mid}
                y={(from.y + to.y) / 2 - 6}
                textAnchor="middle"
                className="mono"
                fontSize="8.5"
                fill="var(--muted-foreground)"
              >
                {edge.value}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node, i) => {
          const style = KIND_STYLE[node.kind];
          const selected = selectedId === node.id;
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: dim(node.id) ? 0.22 : 1, scale: 1 }}
              transition={{ delay: i * 0.025, duration: 0.28 }}
              className="cursor-pointer"
              onClick={() => onSelectNode(node)}
            >
              {selected ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={26}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                />
              ) : null}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.kind === "target" ? 20 : 16}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={node.kind === "target" ? 2.5 : 1.6}
              />
              <text
                x={node.x}
                y={node.y + 3.5}
                textAnchor="middle"
                className="mono"
                fontSize="9"
                fill="var(--foreground)"
              >
                {node.hop === 0 ? "T" : `${node.hop}`}
              </text>
              <text
                x={node.x}
                y={node.y + (node.kind === "target" ? 36 : 32)}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--foreground)"
              >
                {node.label}
              </text>
              <text
                x={node.x}
                y={node.y + (node.kind === "target" ? 48 : 44)}
                textAnchor="middle"
                className="mono"
                fontSize="8.5"
                fill="var(--muted-foreground)"
              >
                {truncateAddress(node.address, 6, 4)}
              </text>
            </motion.g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2.5 rounded-md border border-border bg-surface/90 px-3 py-2 text-[10px] backdrop-blur">
        {(
          [
            ["target", "Target"],
            ["intermediary", "Intermediary"],
            ["bridge", "Bridge"],
            ["candidate_entity", "Candidate"],
            ["vasp", "Attributed VASP"],
          ] as [NodeKind, string][]
        ).map(([kind, label]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span
              className={cn("size-2 rounded-full border")}
              style={{
                borderColor: KIND_STYLE[kind].stroke,
                background:
                  kind === "target" ? KIND_STYLE[kind].fill : "transparent",
              }}
            />
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
