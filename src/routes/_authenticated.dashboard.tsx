import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowRight,
  FolderPlus,
  Radar,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Chip,
  InvestigationStatusBadge,
  Mono,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/vt/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatTile,
} from "@/components/vt/states";
import {
  casesQuery,
  evidenceQuery,
  findingsQuery,
  investigationsQuery,
} from "@/lib/api/queries";
import { chainLabel, truncateAddress } from "@/lib/domain";
import { useUIStore } from "@/stores/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Investigator dashboard — TRACIFY" },
      {
        name: "description",
        content:
          "What needs attention now: active blockchain traces, priority cases, and the latest evidence-backed findings across your TRACIFY workspace.",
      },
      { property: "og:title", content: "Investigator dashboard — TRACIFY" },
      {
        property: "og:description",
        content:
          "Active traces, priority cases and the latest evidence-backed findings in one intelligence console.",
      },
    ],
  }),
  component: DashboardPage,
});

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    return hours <= 1 ? "just now" : `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function DashboardPage() {
  const setCreateCaseOpen = useUIStore((s) => s.setCreateCaseOpen);
  const setStartInvestigationOpen = useUIStore(
    (s) => s.setStartInvestigationOpen,
  );

  const cases = useQuery(casesQuery());
  const investigations = useQuery(investigationsQuery());
  const findings = useQuery(findingsQuery());
  const evidence = useQuery(evidenceQuery());

  const error = cases.error ?? investigations.error ?? findings.error;
  const loading = cases.isLoading || investigations.isLoading;

  const activeInvestigations = (investigations.data ?? []).filter((i) =>
    ["queued", "processing"].includes(i.status),
  );
  const priorityCases = (cases.data ?? []).filter(
    (c) => ["critical", "high"].includes(c.priority) && c.status !== "closed",
  );
  const criticalFindings = (findings.data ?? []).filter((f) =>
    ["critical", "high"].includes(f.severity),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Investigator console"
        title="What needs your attention"
        description="Live traces, priority caseload and the latest evidence-backed findings across your workspace."
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateCaseOpen(true)}>
              <FolderPlus className="size-4" />
              New case
            </Button>
            <Button onClick={() => setStartInvestigationOpen(true)}>
              <Radar className="size-4" />
              Start investigation
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error.message} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Traces in flight"
          value={activeInvestigations.length}
          hint="queued or processing"
          tone="intel"
        />
        <StatTile
          label="Priority caseload"
          value={priorityCases.length}
          hint="high & critical, still open"
          tone="warning"
        />
        <StatTile
          label="Findings to review"
          value={criticalFindings.length}
          hint="high & critical severity"
          tone="critical"
        />
        <StatTile
          label="Evidence items held"
          value={(evidence.data ?? []).length}
          hint="across all cases"
        />
      </div>

      {loading ? (
        <LoadingState rows={3} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold">Active investigations</h2>
                <p className="text-xs text-muted-foreground">
                  Traces currently building or awaiting analysis.
                </p>
              </div>
              <Link
                to="/investigations"
                className="text-xs text-primary hover:underline"
              >
                All investigations
              </Link>
            </div>

            {activeInvestigations.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="No traces in flight"
                description="Every queued trace has completed. Start a new investigation from a case to begin tracing fund movement."
                action={
                  <Button
                    size="sm"
                    onClick={() => setStartInvestigationOpen(true)}
                  >
                    Start investigation
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {activeInvestigations.map((inv, i) => (
                  <motion.li
                    key={inv.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                  >
                    <Link
                      to="/investigations/$investigationId"
                      params={{ investigationId: inv.id }}
                      className="panel block px-4 py-3.5 transition-colors hover:border-border-strong"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Mono className="text-muted-foreground">
                          {inv.investigation_ref}
                        </Mono>
                        <InvestigationStatusBadge status={inv.status} />
                        <Chip>{chainLabel(inv.blockchain)}</Chip>
                        <Chip>{inv.trace_depth} hops</Chip>
                      </div>
                      <p className="mt-2 text-sm font-medium">{inv.name}</p>
                      <p className="mono mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Wallet className="size-3" />
                        {truncateAddress(inv.target_address, 12, 8)}
                      </p>
                      {inv.status === "processing" ? (
                        <div className="mt-3">
                          <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
                            <span>Building bounded graph</span>
                            <span className="mono">
                              hop 2 / {inv.trace_depth}
                            </span>
                          </div>
                          <Progress value={52} className="h-1" />
                        </div>
                      ) : null}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}

            <div className="flex items-end justify-between pt-3">
              <h2 className="text-sm font-semibold">Recent case activity</h2>
              <Link to="/cases" className="text-xs text-primary hover:underline">
                All cases
              </Link>
            </div>
            <ul className="panel divide-y divide-border">
              {(cases.data ?? []).slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60"
                  >
                    <Mono className="w-[112px] shrink-0 text-muted-foreground">
                      {c.case_ref}
                    </Mono>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {c.title}
                    </span>
                    <StatusBadge status={c.status} />
                    <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                      {relative(c.updated_at)}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-5">
            <section className="space-y-3">
              <div className="flex items-end justify-between">
                <h2 className="text-sm font-semibold">High-priority cases</h2>
                <Link to="/cases" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>
              {priorityCases.length === 0 ? (
                <EmptyState
                  icon={FolderPlus}
                  title="No priority cases"
                  description="Nothing is flagged high or critical right now."
                />
              ) : (
                <ul className="space-y-2.5">
                  {priorityCases.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: c.id }}
                        className="panel block px-4 py-3.5 transition-colors hover:border-border-strong"
                      >
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={c.priority} />
                          <Mono className="text-muted-foreground">
                            {c.case_ref}
                          </Mono>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-snug">
                          {c.title}
                        </p>
                        {c.reported_loss ? (
                          <p className="mono mt-1.5 text-[11px] text-muted-foreground">
                            reported loss ${c.reported_loss.toLocaleString()}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-end justify-between">
                <h2 className="text-sm font-semibold">Recent findings</h2>
                <Link
                  to="/findings"
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              {(findings.data ?? []).length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No findings recorded"
                  description="Findings are produced as investigations complete path and entity analysis."
                />
              ) : (
                <ul className="space-y-2.5">
                  {(findings.data ?? []).slice(0, 4).map((f) => (
                    <li key={f.id} className="panel px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <Mono className="text-muted-foreground">
                          {f.finding_ref}
                        </Mono>
                        <span className="mono ml-auto text-[11px] text-muted-foreground">
                          {f.confidence}% conf.
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-snug">
                        {f.title}
                      </p>
                      {f.investigation_id ? (
                        <Link
                          to="/investigations/$investigationId"
                          params={{ investigationId: f.investigation_id }}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          Open in workspace
                          <ArrowRight className="size-3" />
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
