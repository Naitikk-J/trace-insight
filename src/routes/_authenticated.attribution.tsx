import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Radar, Search } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Chip, Mono } from "@/components/vt/badges";
import { BackendGate, BackendStatusChip } from "@/components/vt/BackendGate";
import { EmptyState, PageHeader, StatTile } from "@/components/vt/states";
import { attributeAddress, backendProvidersQuery } from "@/lib/api/backend";
import { FRAUD_TYPES, FRAUD_TYPE_LABEL, type FraudType } from "@/lib/api/backend-types";
import { BLOCKCHAINS, truncateAddress } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/attribution")({
  head: () => ({
    meta: [
      { title: "Exchange attribution — TRACIFY" },
      {
        name: "description",
        content:
          "Trace any suspect wallet in real time and identify the nearest regulated exchange deposit address, intermediary roles, mixer exposure and fraud typology with explainable scoring.",
      },
      { property: "og:title", content: "Exchange attribution — TRACIFY" },
      {
        property: "og:description",
        content:
          "Real-time nearest-VASP attribution for a suspect wallet address, with explainable risk and typology.",
      },
    ],
  }),
  component: AttributionPage,
});

function AttributionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live lookup"
        title="Exchange attribution"
        description="Give the tool a victim-reported wallet and it walks the chain outward, hop by hop, until it hits a regulated exchange deposit address — then explains the route, the value that survived, and what to serve on whom."
        actions={<BackendStatusChip />}
      />
      <BackendGate>
        <AttributionConsole />
      </BackendGate>
    </div>
  );
}

function AttributionConsole() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [maxHops, setMaxHops] = useState(4);
  const [minValueUsd, setMinValueUsd] = useState(50);
  const [direction, setDirection] = useState<"outbound" | "inbound" | "both">("outbound");
  const [fraudType, setFraudType] = useState<FraudType | "auto">("auto");

  const providers = useQuery(backendProvidersQuery());

  const run = useMutation({
    mutationFn: () =>
      attributeAddress({
        address: address.trim(),
        chain,
        maxHops,
        minValueUsd,
        direction,
        ...(fraudType === "auto" ? {} : { fraudType }),
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Attribution failed"),
  });

  const result = run.data;

  return (
    <div className="space-y-5">
      <form
        className="clay space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (address.trim()) run.mutate();
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="addr">Suspect wallet address</Label>
            <Input
              id="addr"
              className="mono"
              placeholder="0x… / bc1…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Chain</Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCKCHAINS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as typeof direction)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">Outbound (follow the money)</SelectItem>
                <SelectItem value="inbound">Inbound (find the sources)</SelectItem>
                <SelectItem value="both">Both directions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Hop boundary · {maxHops}</Label>
            <Slider
              value={[maxHops]}
              min={1}
              max={6}
              step={1}
              onValueChange={([v]) => setMaxHops(v ?? 4)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minv">Minimum value (USD)</Label>
            <Input
              id="minv"
              type="number"
              min={0}
              value={minValueUsd}
              onChange={(e) => setMinValueUsd(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Suspected typology</Label>
            <Select
              value={fraudType}
              onValueChange={(v) => setFraudType(v as FraudType | "auto")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Let the model decide</SelectItem>
                {FRAUD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FRAUD_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={run.isPending || !address.trim()}>
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Attribute address
          </Button>
          {providers.data ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(providers.data).map(([key, value]) => (
                <Chip key={key} tone={String(value).includes("graphsense") ? "positive" : "neutral"}>
                  {key} · {String(value)}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      </form>

      {!result ? (
        <EmptyState
          icon={Radar}
          title="No lookup yet"
          description="Enter a reported wallet to trace it against the live chain index. Results include the nearest exchange, the value trail, intermediary roles and explainable typology scoring."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile
              label="Risk"
              value={result.riskScore}
              hint={result.riskCategory}
              tone="critical"
            />
            <StatTile
              label="Typology"
              value={result.typology.label}
              hint={`${Math.round(result.typology.confidence * 100)}% confidence`}
              tone="intel"
            />
            <StatTile
              label="Value traced"
              value={`$${Math.round(result.metrics.valueTracedUsd).toLocaleString()}`}
              hint={`${result.metrics.addressesTouched} addresses · ${result.metrics.hopsTraced} hops`}
            />
            <StatTile
              label="Freeze actionable"
              value={result.freezeActionable ? "Yes" : "No"}
              hint={result.live ? "live chain index" : "offline model"}
              tone={result.freezeActionable ? "positive" : "warning"}
            />
          </div>

          <section className="panel px-4 py-4">
            <p className="label-caps mb-2">Nearest regulated touchpoint</p>
            {result.nearestVasp ? (
              <div className="clay-inset px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 className="size-4 text-intel" />
                  <span className="text-sm font-semibold">{result.nearestVasp.entity}</span>
                  {result.nearestVasp.directDeposit ? (
                    <Chip tone="positive">direct deposit</Chip>
                  ) : (
                    <Chip>{result.nearestVasp.hops} hops away</Chip>
                  )}
                  <span className="mono ml-auto text-[11px] text-muted-foreground">
                    {Math.round(result.nearestVasp.confidence * 100)}% · $
                    {Math.round(result.nearestVasp.valueUsd).toLocaleString()}
                  </span>
                </div>
                <p className="mono mt-2 break-all text-[11px] text-muted-foreground">
                  {result.nearestVasp.address}
                </p>
                <p className="mono mt-1.5 break-all text-[11px] text-muted-foreground">
                  {result.nearestVasp.path.map((p) => truncateAddress(p, 6, 4)).join(" → ")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No exchange deposit address within {maxHops} hops. Widen the boundary or lower
                the value floor.
              </p>
            )}
          </section>

          <section className="panel px-4 py-4">
            <p className="label-caps mb-2">Why this typology</p>
            <p className="text-sm text-muted-foreground">{result.typology.rationale}</p>
            <div className="mt-3 space-y-1.5">
              {result.typology.drivers.map((d) => (
                <div key={d.feature} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 text-[12px] text-muted-foreground">
                    {d.label}
                  </span>
                  <div className="h-1.5 flex-1 rounded-full bg-secondary">
                    <div
                      className={d.weight >= 0 ? "h-1.5 rounded-full bg-intel" : "h-1.5 rounded-full bg-muted-foreground"}
                      style={{ width: `${Math.min(100, Math.abs(d.weight) * 100)}%` }}
                    />
                  </div>
                  <Mono className="w-14 text-right text-[11px] text-muted-foreground">
                    {d.weight.toFixed(2)}
                  </Mono>
                </div>
              ))}
            </div>
            {result.typology.alternatives.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.typology.alternatives.map((alt) => (
                  <Chip key={alt.type}>
                    {alt.label} · {Math.round(alt.confidence * 100)}%
                  </Chip>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel px-4 py-4">
            <p className="label-caps mb-2">Signals & exposure</p>
            <div className="flex flex-wrap gap-1.5">
              {result.obfuscation.detected ? (
                <Chip tone="critical" dot>
                  mixer exposure
                </Chip>
              ) : null}
              {result.crossChain.detected ? (
                <Chip tone="warning" dot>
                  cross-chain movement
                </Chip>
              ) : null}
              {result.signals.map((s) => (
                <Chip key={s.code} tone="intel">
                  {s.label}
                </Chip>
              ))}
            </div>
            <ul className="mt-3 space-y-1 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
              {result.riskReasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </section>

          {result.intermediaries.length > 0 ? (
            <section className="panel px-4 py-4">
              <p className="label-caps mb-2">Intermediary wallets</p>
              <div className="space-y-1.5">
                {result.intermediaries.map((w) => (
                  <p key={w.address} className="mono text-[11px] text-muted-foreground">
                    hop {w.hop} · {truncateAddress(w.address, 10, 8)} · {w.role} · $
                    {Math.round(w.valueUsd).toLocaleString()} — {w.reason}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {result.recommendations.length > 0 ? (
            <section className="panel px-4 py-4">
              <p className="label-caps mb-2">Recommended actions</p>
              <ul className="space-y-1 text-[12px] text-muted-foreground">
                {result.recommendations.map((r) => (
                  <li key={r}>→ {r}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
