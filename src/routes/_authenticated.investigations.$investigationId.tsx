import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Copy,
  Fingerprint,
  Layers,
  Pin,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Chip,
  InvestigationStatusBadge,
  Mono,
  SeverityBadge,
} from "@/components/vt/badges";
import { GraphCanvas, NODE_KIND_LABEL } from "@/components/vt/GraphCanvas";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatTile,
} from "@/components/vt/states";
import {
  createEvidence,
  createFinding,
  investigationQuery,
} from "@/lib/api/queries";
import { chainLabel, truncateAddress } from "@/lib/domain";
import { intelligence } from "@/services/intelligence";
import type { GraphEdge, GraphNode } from "@/services/intelligence";
import { useWorkspaceStore } from "@/stores/ui";

export const Route = createFileRoute(
  "/_authenticated/investigations/$investigationId",
)({
  head: () => ({
    meta: [
      { title: "Investigation workspace — VASPTRACE" },
      {
        name: "description",
        content:
          "The investigation workspace: a bounded fund-flow graph, ranked value-continuity paths, entity and VASP attribution candidates, behavioural signals and a chronological timeline.",
      },
      { property: "og:title", content: "Investigation workspace — VASPTRACE" },
      {
        property: "og:description",
        content:
          "Bounded fund-flow graph, ranked paths, attribution candidates and behavioural signals in one investigative canvas.",
      },
    ],
  }),
  component: WorkspacePage,
});

function copy(value: string) {
  void navigator.clipboard.writeText(value);
  toast.success("Copied to clipboard.");
}

function WorkspacePage() {
  const { investigationId } = Route.useParams();
  const queryClient = useQueryClient();
  const selection = useWorkspaceStore((s) => s.selection);
  const select = useWorkspaceStore((s) => s.select);
  const focusedPath = useWorkspaceStore((s) => s.focusedPath);
  const setFocusedPath = useWorkspaceStore((s) => s.setFocusedPath);

  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  const investigation = useQuery(investigationQuery(investigationId));

  const analysis = useMemo(() => {
    if (!investigation.data) return null;
    const graph = intelligence.graph.build(investigation.data);
    return {
      graph,
      paths: intelligence.paths.rank(graph),
      entities: intelligence.entities.candidates(graph),
      signals: intelligence.risk.signals(graph),
      timeline: intelligence.timeline(graph),
    };
  }, [investigation.data]);

  const pinEvidence = useMutation({
    mutationFn: (input: { title: string; description: string; type: string }) =>
      createEvidence({
        investigation_id: investigationId,
        case_id: investigation.data?.case_id ?? null,
        title: input.title,
        evidence_type: input.type,
        description: input.description,
        source: `VASPTRACE workspace · ${investigation.data?.investigation_ref ?? ""}`,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["evidence"] });
      toast.success("Pinned to the evidence vault.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordFinding = useMutation({
    mutationFn: (input: {
      title: string;
      description: string;
      severity: string;
      confidence: number;
      type: string;
    }) =>
      createFinding({
        investigation_id: investigationId,
        case_id: investigation.data?.case_id ?? null,
        title: input.title,
        description: input.description,
        severity: input.severity,
        confidence: input.confidence,
        finding_type: input.type,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding recorded against this case.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (investigation.isLoading) return <LoadingState rows={5} />;
  if (investigation.error)
    return <ErrorState message={investigation.error.message} />;

  const record = investigation.data!;
  const { graph, paths, entities, signals, timeline } = analysis!;

  const selectedNode: GraphNode | null =
    selection.kind === "wallet"
      ? (graph.nodes.find((n) => n.id === selection.id) ?? null)
      : null;
  const primaryPath = paths[0];

  return (
    <div className="space-y-5">
      <Link
        to="/cases/$caseId"
        params={{ caseId: record.case_id }}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to case file
      </Link>

      {/* Workspace header */}
      <header className="panel px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Mono className="text-muted-foreground">
                {record.investigation_ref}
              </Mono>
              <InvestigationStatusBadge status={record.status} />
              <Chip>{chainLabel(record.blockchain)}</Chip>
              <Chip tone="intel">{record.trace_depth}-hop bound</Chip>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              {record.name}
            </h1>
            <button
              onClick={() => copy(record.target_address)}
              className="mono mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {record.target_address}
              <Copy className="size-3" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pinEvidence.isPending}
              onClick={() =>
                pinEvidence.mutate({
                  title: `Graph snapshot — ${record.investigation_ref}`,
                  description: `Bounded graph at ${graph.bounds.hops} hops: ${graph.nodes.length} addresses, ${graph.edges.length} traced transfers.`,
                  type: "graph_snapshot",
                })
              }
            >
              <Pin className="size-4" />
              Pin graph snapshot
            </Button>
            <Button
              size="sm"
              disabled={recordFinding.isPending || !primaryPath}
              onClick={() =>
                primaryPath &&
                recordFinding.mutate({
                  title: `Primary path terminates at ${NODE_KIND_LABEL[primaryPath.endpointKind].toLowerCase()}`,
                  description: `${primaryPath.verdict} ${primaryPath.valuePreserved} preserved across ${primaryPath.hops} hops (continuity ${(primaryPath.continuity * 100).toFixed(0)}%).`,
                  severity: primaryPath.continuity > 0.7 ? "high" : "medium",
                  confidence: primaryPath.confidence,
                  type: "path_continuity",
                })
              }
            >
              <Sparkles className="size-4" />
              Record primary finding
            </Button>
          </div>
        </div>

        {record.status === "processing" ? (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>Ingesting and bounding the graph</span>
              <span className="mono">hop 2 / {record.trace_depth}</span>
            </div>
            <Progress value={52} className="h-1" />
          </div>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Addresses in scope"
          value={graph.nodes.length}
          hint={`bounded at ${graph.bounds.hops} hops`}
        />
        <StatTile
          label="Traced transfers"
          value={graph.edges.length}
          hint="value-carrying edges"
        />
        <StatTile
          label="Relevant paths"
          value={paths.length}
          hint="ranked by value continuity"
          tone="intel"
        />
        <StatTile
          label="Attribution candidates"
          value={entities.length}
          hint="entity / VASP inference"
          tone="positive"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Canvas + analysis */}
        <div className="space-y-4">
          <GraphCanvas
            graph={graph}
            paths={paths}
            focusedPath={focusedPath}
            selectedId={selection.id}
            onSelectNode={(node) => {
              setSelectedEdge(null);
              select("wallet", node.id);
            }}
            onSelectEdge={(edge) => {
              select("transaction", edge.id);
              setSelectedEdge(edge);
            }}
          />

          <Tabs defaultValue="paths">
            <TabsList>
              <TabsTrigger value="paths">Paths</TabsTrigger>
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="paths" className="mt-3 space-y-2.5">
              {paths.map((p) => {
                const active = focusedPath === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setFocusedPath(active ? null : p.id)}
                    className={`panel w-full px-4 py-3.5 text-left transition-colors ${
                      active ? "border-primary/60" : "hover:border-border-strong"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <RouteIcon className="size-3.5 text-muted-foreground" />
                      <Mono className="text-muted-foreground">{p.id}</Mono>
                      <span className="text-sm font-medium">{p.label}</span>
                      <Chip
                        tone={
                          p.continuity > 0.7
                            ? "positive"
                            : p.continuity > 0.4
                              ? "warning"
                              : "neutral"
                        }
                        className="ml-auto"
                      >
                        {(p.continuity * 100).toFixed(0)}% continuity
                      </Chip>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {p.verdict}
                    </p>
                    <div className="mono mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                      <span>{p.valuePreserved} preserved</span>
                      <span>{p.hops} hops</span>
                      <span>ends at {NODE_KIND_LABEL[p.endpointKind]}</span>
                      <span className="ml-auto">
                        {p.confidence}% confidence
                      </span>
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Selecting a path dims everything outside it, so the canvas shows
                only the movement that supports that hypothesis.
              </p>
            </TabsContent>

            <TabsContent value="entities" className="mt-3 space-y-2.5">
              {entities.length === 0 ? (
                <EmptyState
                  icon={Fingerprint}
                  title="No attribution candidates"
                  description="No endpoint in scope matches an attribution set. Extending the hop bound may reach an attributed service."
                />
              ) : (
                entities.map((e) => (
                  <article key={e.id} className="panel px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{e.name}</span>
                      <Chip tone="intel">{e.type}</Chip>
                      <Chip
                        tone={
                          e.attributionStrength > 0.7 ? "positive" : "warning"
                        }
                        className="ml-auto"
                      >
                        {(e.attributionStrength * 100).toFixed(0)}% attribution
                      </Chip>
                    </div>
                    <ul className="mt-2.5 space-y-1">
                      {e.rationale.map((r) => (
                        <li
                          key={r}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <div className="mono mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                      <span>hop {e.proximityHops}</span>
                      <span>{e.networks.join(", ")}</span>
                      <span>{e.associatedAddresses} associated addresses</span>
                      <span>{e.sourceFreshness}</span>
                    </div>
                  </article>
                ))
              )}
            </TabsContent>

            <TabsContent value="signals" className="mt-3 space-y-2.5">
              {signals.map((s) => (
                <article key={s.id} className="panel px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{s.pattern}</span>
                    <SeverityBadge severity={s.severity} />
                    <span className="mono ml-auto text-[11px] text-muted-foreground">
                      {s.observedAt}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-2"
                    disabled={recordFinding.isPending}
                    onClick={() =>
                      recordFinding.mutate({
                        title: s.pattern,
                        description: s.description,
                        severity: s.severity,
                        confidence: 72,
                        type: "behavioural_pattern",
                      })
                    }
                  >
                    Record as finding
                  </Button>
                </article>
              ))}
              <p className="text-xs text-muted-foreground">
                Signals describe observed behaviour. They are not conclusions
                until an investigator records them as a finding.
              </p>
            </TabsContent>

            <TabsContent value="timeline" className="mt-3">
              <ol className="panel space-y-0 px-4 py-2">
                {timeline.map((event, i) => (
                  <motion.li
                    key={event.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.22 }}
                    className="flex gap-3 border-b border-border py-3 last:border-b-0"
                  >
                    <div className="mono w-[86px] shrink-0 text-[11px] text-muted-foreground">
                      <div>{event.at}</div>
                      <div className="text-foreground">{event.clock}</div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="mono mt-0.5 text-[11px] text-muted-foreground">
                        {event.detail}
                      </p>
                    </div>
                    <Chip className="ml-auto shrink-0">{event.kind}</Chip>
                  </motion.li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>
        </div>

        {/* Inspector */}
        <aside className="panel h-fit xl:sticky xl:top-[88px]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Layers className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Inspector</p>
            <Chip className="ml-auto">
              {selectedEdge
                ? "Transaction"
                : selectedNode
                  ? NODE_KIND_LABEL[selectedNode.kind]
                  : "Nothing selected"}
            </Chip>
          </div>

          <ScrollArea className="max-h-[560px]">
            <div className="px-4 py-4">
              {selectedEdge ? (
                <div className="space-y-3">
                  <button
                    onClick={() => copy(selectedEdge.txHash)}
                    className="mono flex w-full items-center gap-1.5 break-all rounded-md border border-border bg-elevated/50 px-3 py-2 text-left text-[11px] hover:text-foreground"
                  >
                    {truncateAddress(selectedEdge.txHash, 18, 10)}
                    <Copy className="ml-auto size-3 shrink-0" />
                  </button>
                  <dl className="mono space-y-2 text-[12px]">
                    <Row label="value" value={selectedEdge.value} />
                    <Row label="asset" value={selectedEdge.asset} />
                    <Row label="observed" value={selectedEdge.timestamp} />
                    <Row
                      label="continuity"
                      value={`${(selectedEdge.continuity * 100).toFixed(0)}%`}
                    />
                    <Row
                      label="on paths"
                      value={selectedEdge.pathIds.join(", ")}
                    />
                  </dl>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={pinEvidence.isPending}
                    onClick={() =>
                      pinEvidence.mutate({
                        title: `Transfer ${truncateAddress(selectedEdge.txHash, 10, 6)}`,
                        description: `${selectedEdge.value} ${selectedEdge.asset} moved at ${selectedEdge.timestamp} with ${(selectedEdge.continuity * 100).toFixed(0)}% value continuity.`,
                        type: "transaction",
                      })
                    }
                  >
                    <Pin className="size-4" />
                    Pin transaction as evidence
                  </Button>
                </div>
              ) : selectedNode ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {selectedNode.label}
                    </p>
                    <button
                      onClick={() => copy(selectedNode.address)}
                      className="mono mt-1 flex w-full items-center gap-1.5 break-all rounded-md border border-border bg-elevated/50 px-3 py-2 text-left text-[11px] hover:text-foreground"
                    >
                      {truncateAddress(selectedNode.address, 18, 10)}
                      <Copy className="ml-auto size-3 shrink-0" />
                    </button>
                  </div>
                  <dl className="mono space-y-2 text-[12px]">
                    <Row label="hop" value={String(selectedNode.hop)} />
                    <Row label="value in" value={selectedNode.valueIn} />
                    <Row label="value out" value={selectedNode.valueOut} />
                    <Row
                      label="connected"
                      value={`${selectedNode.connectedAddresses} addresses`}
                    />
                    <Row
                      label="on paths"
                      value={`${selectedNode.relevantPaths}`}
                    />
                    <Row label="first seen" value={selectedNode.firstSeen} />
                  </dl>
                  {selectedNode.riskNote ? (
                    <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
                      {selectedNode.riskNote}
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={pinEvidence.isPending}
                    onClick={() =>
                      pinEvidence.mutate({
                        title: `Wallet ${truncateAddress(selectedNode.address, 10, 6)}`,
                        description: `${NODE_KIND_LABEL[selectedNode.kind]} at hop ${selectedNode.hop}. In ${selectedNode.valueIn}, out ${selectedNode.valueOut}.`,
                        type: "wallet",
                      })
                    }
                  >
                    <Pin className="size-4" />
                    Pin wallet as evidence
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Select a wallet or a transfer on the canvas to inspect its
                    traced values, its position in the graph and why it is in
                    scope.
                  </p>
                  <div className="mono space-y-2 border-t border-border pt-3 text-[11px]">
                    <Row
                      label="trace window"
                      value={
                        record.window_start
                          ? `${new Date(record.window_start).toLocaleDateString()} → ${
                              record.window_end
                                ? new Date(
                                    record.window_end,
                                  ).toLocaleDateString()
                                : "now"
                            }`
                          : "unbounded"
                      }
                    />
                    <Row
                      label="min value"
                      value={
                        record.min_value
                          ? `${record.min_value.toLocaleString()} USDT`
                          : "no floor"
                      }
                    />
                    <Row label="max nodes" value={`${graph.bounds.maxNodes}`} />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5" />
                    Scope is deliberately bounded — VASPTRACE never crawls the
                    whole chain.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
