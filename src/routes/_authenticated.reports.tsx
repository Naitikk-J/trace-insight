import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileText, Printer, Sparkles, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, Mono } from "@/components/vt/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/vt/states";
import { casesQuery, investigationsQuery, reportsQuery } from "@/lib/api/queries";
import { ReportBuilderDialog } from "@/components/vt/ReportBuilderDialog";
import { intelligence } from "@/services/intelligence";
import type { InvestigationRecord } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Intelligence reports — TRACIFY" },
      {
        name: "description",
        content:
          "Assembled intelligence reports: executive summary, traced fund paths, entity and VASP attribution, behavioural signals and the supporting evidence index.",
      },
      { property: "og:title", content: "Intelligence reports — TRACIFY" },
      {
        property: "og:description",
        content:
          "Court-ready reports assembled from findings and evidence held against a case.",
      },
    ],
  }),
  component: ReportsPage,
});

const STATUS_TONE: Record<string, "neutral" | "info" | "positive" | "intel"> = {
  draft: "neutral",
  in_review: "info",
  final: "positive",
  published: "intel",
};

function ReportsPage() {
  const reports = useQuery(reportsQuery());
  const cases = useQuery(casesQuery());
  const investigations = useQuery(investigationsQuery());

  const [activeReportInv, setActiveReportInv] = useState<InvestigationRecord | null>(null);

  const caseRef = (id: string | null) =>
    id ? ((cases.data ?? []).find((c) => c.id === id)?.case_ref ?? null) : null;

  const handleOpenBuilderForInvestigation = (inv: InvestigationRecord) => {
    setActiveReportInv(inv);
  };

  const activeAnalysis = activeReportInv
    ? (() => {
        const graph = intelligence.graph.build(activeReportInv);
        return {
          investigation: activeReportInv,
          caseRef: caseRef(activeReportInv.case_id) || undefined,
          paths: intelligence.paths.rank(graph),
          entities: intelligence.entities.candidates(graph),
          signals: intelligence.risk.signals(graph),
          timeline: intelligence.timeline(graph),
          findingsCount: 0,
          evidenceCount: 0,
        };
      })()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          eyebrow="Output & Evidence Hand-off"
          title="Intelligence Reports"
          description="Reports restate what the cryptographic evidence supports, in language law enforcement, prosecutors, and compliance teams can act on."
        />
        {investigations.data && investigations.data.length > 0 && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => handleOpenBuilderForInvestigation(investigations.data![0]!)}
          >
            <Sparkles className="size-3.5" />
            Assemble New Dossier
          </Button>
        )}
      </div>

      {reports.error ? <ErrorState message={reports.error.message} /> : null}

      {reports.isLoading ? (
        <LoadingState rows={3} />
      ) : (reports.data ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports assembled yet"
          description="Once an investigation has verified paths and attributed VASP endpoints, generate a dossier to seal the chain of custody."
        />
      ) : (
        <div className="space-y-3.5">
          {(reports.data ?? []).map((r) => {
            const linkedInv = (investigations.data ?? []).find(
              (i) => i.id === r.investigation_id
            );
            return (
              <article
                key={r.id}
                className="panel p-5 bg-surface/30 hover:border-border-strong transition-all space-y-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mono className="text-muted-foreground font-semibold">{r.report_ref}</Mono>
                    <Chip tone={STATUS_TONE[r.status] ?? "neutral"} dot>
                      {r.status.replace(/_/g, " ").toUpperCase()}
                    </Chip>
                    {caseRef(r.case_id) ? (
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: r.case_id! }}
                        className="mono text-[11px] text-primary hover:underline font-medium"
                      >
                        {caseRef(r.case_id)}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground mono">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                    {linkedInv && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleOpenBuilderForInvestigation(linkedInv)}
                      >
                        <FileDown className="size-3" />
                        View / Export Dossier
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-base font-semibold text-foreground tracking-tight">
                    {r.title}
                  </h2>
                  {r.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-3xl">
                      {r.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
                  <span className="text-[10px] mono uppercase text-muted-foreground/70 mr-1.5">
                    Included Sections:
                  </span>
                  {(r.sections ?? []).map((s) => (
                    <Chip key={s} tone="neutral" className="text-[10px]">
                      {s.replace(/_/g, " ")}
                    </Chip>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Report Builder Dialog */}
      <ReportBuilderDialog
        open={Boolean(activeReportInv)}
        onOpenChange={(open) => {
          if (!open) setActiveReportInv(null);
        }}
        data={activeAnalysis}
      />
    </div>
  );
}
