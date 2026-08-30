/**
 * AI workspace — the two systems side by side, and never confused for each other.
 *
 * Left: the platform's own risk model, which predicts which route the money took.
 * Right: the external copilot, which explains that prediction in plain language.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, Cpu, Loader2, Radar, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip, Mono } from "@/components/vt/badges";
import { BackendGate, BackendStatusChip } from "@/components/vt/BackendGate";
import { ClayCard } from "@/components/vt/clay";
import { CopilotPanel } from "@/components/vt/CopilotPanel";
import { RoutePredictionPanel } from "@/components/vt/RoutePredictionPanel";
import { EmptyState, PageHeader, StatTile } from "@/components/vt/states";
import {
  aiStatusQuery,
  backendInvestigationsQuery,
  predictMoneyRoute,
} from "@/lib/api/backend";
import { truncateAddress } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "AI route prediction & copilot — TRACIFY" },
      {
        name: "description",
        content:
          "TRACIFY's own risk model ranks every candidate laundering route out of a suspect wallet and shows the signed feature contributions behind its choice, while a grounded copilot explains the result to investigators.",
      },
      { property: "og:title", content: "AI route prediction & copilot — TRACIFY" },
      {
        property: "og:description",
        content:
          "Explainable money-route prediction from observed chain data, paired with a grounded investigator copilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiWorkspacePage,
});

function AiWorkspacePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dual intelligence"
        title="Route prediction & copilot"
        description="Two separate systems, deliberately kept apart. TRACIFY's own model decides which path the money most likely took and shows its arithmetic; the copilot only puts that finding into words an investigator can hand to a magistrate."
        actions={<BackendStatusChip />}
      />
      <BackendGate>
        <AiWorkspace />
      </BackendGate>
    </div>
  );
}

function AiWorkspace() {
  const status = useQuery(aiStatusQuery());
  const investigations = useQuery(backendInvestigationsQuery());
  const [selected, setSelected] = useState<string>("");

  const items = investigations.data?.items ?? [];

  useEffect(() => {
    if (!selected && items.length > 0) setSelected(items[0]!.id);
  }, [items, selected]);

  const predict = useMutation({
    mutationFn: (investigationId: string) => predictMoneyRoute(investigationId),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Route prediction failed"),
  });

  const current = items.find((item) => item.id === selected);

  if (investigations.isLoading || status.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading intelligence systems…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <SystemsStatus status={status.data} />

      {items.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No traced investigations yet"
          description="The model predicts routes from graphs the platform has already traced. Run an attribution or open an investigation on the intelligence service first."
        />
      ) : (
        <>
          <ClayCard className="flex flex-wrap items-end gap-3 p-5">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <Label htmlFor="ai-investigation">Investigation</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="ai-investigation">
                  <SelectValue placeholder="Pick an investigation" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.reference} · {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="gap-1.5"
              disabled={!selected || predict.isPending}
              onClick={() => selected && predict.mutate(selected)}
            >
              {predict.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Predict money route
            </Button>
          </ClayCard>

          {current && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Root address"
                value={truncateAddress(current.rootAddress, 8, 6)}
                hint={current.chain}
              />
              <StatTile label="Hops traced" value={String(current.metrics.hopsTraced)} />
              <StatTile
                label="Value traced"
                value={`$${Math.round(current.metrics.valueTracedUsd).toLocaleString()}`}
              />
              <StatTile
                label="VASP touchpoints"
                value={String(current.metrics.vaspTouchpoints)}
                tone={current.metrics.vaspTouchpoints > 0 ? "positive" : "default"}
              />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {predict.data ? (
                <RoutePredictionPanel result={predict.data} />
              ) : (
                <ClayCard className="p-5">
                  <p className="text-sm text-muted-foreground">
                    Run a prediction to see the ranked candidate routes, the winning trail, and the
                    signed feature contributions behind the score.
                  </p>
                </ClayCard>
              )}
            </div>

            {selected && (
              <CopilotPanel
                investigationId={selected}
                enabled={status.data?.copilot.enabled ?? false}
                dataPolicy={status.data?.copilot.dataPolicy ?? "REDACTED"}
                providerLabel={
                  status.data?.copilot.model
                    ? `${status.data.copilot.provider} · ${status.data.copilot.model}`
                    : (status.data?.copilot.provider ?? "local")
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SystemsStatus({ status }: { status: ReturnType<typeof Object> | undefined }) {
  const data = status as
    | import("@/lib/api/backend-types").AiSystemsStatus
    | undefined;
  if (!data) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ClayCard className="space-y-3 p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Cpu className="size-4 text-primary" />
          System 1 — TRACIFY risk model
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{data.boundary.riskModel}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={data.riskModel.active === "remote" ? "info" : "intel"} dot>
            {data.riskModel.active === "remote" ? "trained model service" : "explainable baseline"}
          </Chip>
          <Chip tone="neutral">
            <Mono>
              {data.riskModel.baseline.id} · {data.riskModel.baseline.version}
            </Mono>
          </Chip>
          <Chip tone="neutral">features v{data.riskModel.featureSchemaVersion}</Chip>
          {data.riskModel.remote.configured && (
            <Chip tone={data.riskModel.remote.reachable ? "positive" : "warning"}>
              {data.riskModel.remote.reachable
                ? `remote reachable${data.riskModel.remote.version ? ` · ${data.riskModel.remote.version}` : ""}`
                : `remote unreachable${data.riskModel.remote.detail ? ` · ${data.riskModel.remote.detail}` : ""}`}
            </Chip>
          )}
        </div>
      </ClayCard>

      <ClayCard className="space-y-3 p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Brain className="size-4 text-intel" />
          System 2 — Investigator copilot
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{data.boundary.copilot}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={data.copilot.enabled ? "positive" : "neutral"} dot>
            {data.copilot.enabled ? data.copilot.provider : "local briefing fallback"}
          </Chip>
          {data.copilot.model && (
            <Chip tone="neutral">
              <Mono>{data.copilot.model}</Mono>
            </Chip>
          )}
          <Chip tone="intel">egress: {data.copilot.dataPolicy}</Chip>
        </div>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {data.copilot.restrictions.slice(0, 3).map((restriction) => (
            <li key={restriction} className="flex gap-2">
              <span aria-hidden className="text-critical">
                ×
              </span>
              {restriction}
            </li>
          ))}
        </ul>
      </ClayCard>
    </div>
  );
}
