import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BrainCircuit, Loader2, MessageSquareText, Route as RouteIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Mono } from "@/components/vt/badges";
import { BackendGate, BackendStatusChip } from "@/components/vt/BackendGate";
import { ClayCard, SectionHeading } from "@/components/vt/clay";
import { PageHeader } from "@/components/vt/states";
import {
  aiStatusQuery,
  askCopilot,
  predictMoneyRoute,
} from "@/lib/api/backend";
import type { CopilotAnswer, RoutePrediction, ScoredRoute } from "@/lib/api/backend-types";
import { BLOCKCHAINS, truncateAddress } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "AI copilot & route prediction — TRACIFY" },
      {
        name: "description",
        content:
          "TRACIFY's dual AI: an explainable in-house model ranks the most likely laundering route, and a grounded copilot explains findings without raw case data ever leaving the platform.",
      },
      { property: "og:title", content: "AI copilot & route prediction — TRACIFY" },
      {
        property: "og:description",
        content:
          "Explainable money-route prediction plus a privacy-preserving investigator copilot.",
      },
    ],
  }),
  component: AiPage,
});

const PRIORITY_TONE = {
  critical: "critical",
  high: "warning",
  medium: "info",
  low: "neutral",
} as const;

function AiPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dual AI"
        title="AI copilot & route prediction"
        description="Two systems, one boundary: TRACIFY's own model scores and ranks candidate money routes from pure graph arithmetic; the copilot only ever sees redacted, whitelisted facts — never raw case data."
        actions={<BackendStatusChip />}
      />
      <BackendGate>
        <AiWorkspace />
      </BackendGate>
    </div>
  );
}

function AiWorkspace() {
  const [chain, setChain] = useState<string>(BLOCKCHAINS[0] ?? "ethereum");
  const [address, setAddress] = useState("");
  const [question, setQuestion] = useState("Explain the most likely laundering route and what to freeze first.");
  const [prediction, setPrediction] = useState<RoutePrediction | null>(null);
  const [copilot, setCopilot] = useState<CopilotAnswer | null>(null);

  const status = useQuery(aiStatusQuery());

  const predict = useMutation({
    mutationFn: predictMoneyRoute,
    onSuccess: (data) => setPrediction(data.prediction),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Route prediction failed"),
  });

  const copilotMutation = useMutation({
    mutationFn: askCopilot,
    onSuccess: (data) => setCopilot(data.copilot),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Copilot request failed"),
  });

  const valid = address.trim().length >= 8;

  return (
    <div className="space-y-6">
      {/* Systems status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ClayCard className="p-5">
          <div className="flex items-center gap-3">
            <RouteIcon className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">System 1 — route model (ours)</p>
              <p className="text-xs text-muted-foreground">
                {status.data
                  ? `${status.data.routeModel.id} · ${status.data.routeModel.configured}`
                  : "Checking…"}
              </p>
            </div>
            <Chip tone="positive" dot className="ml-auto">
              {status.data?.routeModel.healthy ? "Online" : "…"}
            </Chip>
          </div>
        </ClayCard>
        <ClayCard className="p-5" delay={0.05}>
          <div className="flex items-center gap-3">
            <BrainCircuit className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">System 2 — copilot (external LLM)</p>
              <p className="text-xs text-muted-foreground">
                {status.data
                  ? `${status.data.copilot.configured} · ${status.data.copilot.model}`
                  : "Checking…"}
              </p>
            </div>
            <Chip tone={status.data?.copilot.egress.fullAddresses ? "warning" : "positive"} dot className="ml-auto">
              {status.data?.copilot.egress.fullAddresses ? "Full egress" : "Redacted"}
            </Chip>
          </div>
        </ClayCard>
      </div>

      {/* Shared input */}
      <ClayCard className="p-5">
        <SectionHeading
          title="Subject wallet"
          description="Both systems trace the same suspect address — one scores the routes, the other explains them."
        />
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-1.5">
            <Label>Chain</Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOCKCHAINS.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Suspect address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… / bc1… / T…"
              className="font-mono"
            />
          </div>
        </div>
      </ClayCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Route prediction */}
        <ClayCard className="p-5">
          <SectionHeading
            title="Money-route prediction"
            description="Candidate paths are generated algorithmically; the model ranks them with signed per-feature contributions."
            action={
              <Button
                size="sm"
                disabled={!valid || predict.isPending}
                onClick={() => predict.mutate({ chain, address: address.trim() })}
              >
                {predict.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RouteIcon className="mr-2 size-4" />}
                Predict route
              </Button>
            }
          />
          {prediction ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{prediction.note}</p>
              <Chip tone="neutral">
                Model: {prediction.model.id} · v{prediction.model.version}
              </Chip>
              <div className="space-y-3">
                {prediction.routes.slice(0, 4).map((r) => (
                  <RouteCard key={r.path.join(">")} route={r} winning={r === prediction.winningRoute} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run a prediction to see the ranked laundering routes with explainable scoring.
            </p>
          )}
        </ClayCard>

        {/* Copilot */}
        <ClayCard className="p-5" delay={0.05}>
          <SectionHeading
            title="Investigator copilot"
            description="Grounded only on redacted TRACIFY facts. Explanations are never evidence."
          />
          <div className="space-y-3">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Ask about the trace…"
            />
            <Button
              size="sm"
              disabled={!valid || question.trim().length < 4 || copilotMutation.isPending}
              onClick={() =>
                copilotMutation.mutate({ chain, address: address.trim(), question: question.trim() })
              }
            >
              {copilotMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MessageSquareText className="mr-2 size-4" />}
              Ask copilot
            </Button>
            {copilot ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{copilot.answer}</p>
                <div className="flex flex-wrap gap-2">
                  <Chip tone={copilot.external ? "info" : "positive"} dot>
                    {copilot.external ? `${copilot.provider} · ${copilot.model}` : "Local briefing — nothing left the platform"}
                  </Chip>
                  <Chip tone="neutral">{copilot.groundingKeys} grounded facts</Chip>
                  <Chip tone={copilot.dataPolicy.fullAddresses ? "warning" : "positive"}>
                    {copilot.dataPolicy.fullAddresses ? "Full addresses sent" : "Addresses masked"}
                  </Chip>
                </div>
              </div>
            ) : null}
          </div>
        </ClayCard>
      </div>
    </div>
  );
}

function RouteCard({ route, winning }: { route: ScoredRoute; winning: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${winning ? "border-primary/50 bg-primary/5" : "border-border/60"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {winning ? <Sparkles className="size-4 text-primary" /> : null}
          <Mono>{truncateAddress(route.endpoint)}</Mono>
          {route.endpointEntity ? (
            <span className="text-xs text-muted-foreground">{route.endpointEntity}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={PRIORITY_TONE[route.priority]} dot>{route.priority}</Chip>
          <span className="text-sm font-semibold">{Math.round(route.riskScore * 100)}%</span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {route.hops} hops · ~${route.valueUsd.toLocaleString()} · {route.path.length} addresses
        {route.endpointIsVasp ? " · ends at a VASP" : ""}
      </p>
      {route.contributions.length > 0 ? (
        <div className="mt-3 space-y-1">
          {route.contributions.slice(0, 4).map((c) => (
            <div key={c.feature} className="flex items-center gap-2 text-[11px]">
              <span className="w-36 shrink-0 text-muted-foreground">{c.feature}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${c.contribution >= 0 ? "bg-primary" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, Math.abs(c.contribution) * 40)}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono">
                {c.contribution >= 0 ? "+" : ""}{c.contribution.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
