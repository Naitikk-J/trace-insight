import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Chip, Mono } from "@/components/vt/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/vt/states";
import { casesQuery, reportsQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Intelligence reports — VASPTRACE" },
      {
        name: "description",
        content:
          "Assembled intelligence reports: executive summary, traced fund paths, entity and VASP attribution, behavioural signals and the supporting evidence index.",
      },
      { property: "og:title", content: "Intelligence reports — VASPTRACE" },
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

  const caseRef = (id: string | null) =>
    id ? ((cases.data ?? []).find((c) => c.id === id)?.case_ref ?? null) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Output"
        title="Intelligence reports"
        description="Reports restate what the evidence supports, in the language a prosecutor or compliance officer can act on — no unexplained scores."
      />

      {reports.error ? <ErrorState message={reports.error.message} /> : null}

      {reports.isLoading ? (
        <LoadingState rows={3} />
      ) : (reports.data ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports assembled"
          description="Once a case has supported findings and held evidence, assemble a report to hand off the investigation."
        />
      ) : (
        <div className="space-y-3">
          {(reports.data ?? []).map((r) => (
            <article key={r.id} className="panel px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Mono className="text-muted-foreground">{r.report_ref}</Mono>
                <Chip tone={STATUS_TONE[r.status] ?? "neutral"} dot>
                  {r.status.replace(/_/g, " ")}
                </Chip>
                {caseRef(r.case_id) ? (
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: r.case_id! }}
                    className="mono text-[11px] text-primary hover:underline"
                  >
                    {caseRef(r.case_id)}
                  </Link>
                ) : null}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              <h2 className="mt-2.5 text-sm font-semibold">{r.title}</h2>
              {r.notes ? (
                <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
                  {r.notes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {(r.sections ?? []).map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
