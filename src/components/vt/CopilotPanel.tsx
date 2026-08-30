/**
 * Investigator copilot — the external language model.
 *
 * Everything it says is grounded in the platform's own output, which is why the
 * transcript always shows which model answered, which data policy applied, and
 * whether the answer was produced locally because the copilot was unavailable.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, CornerDownLeft, FileText, ListChecks, Loader2, Route, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/vt/badges";
import { ClayCard } from "@/components/vt/clay";
import { askCopilot } from "@/lib/api/backend";
import type { CopilotMode, CopilotResponse } from "@/lib/api/backend-types";

const QUICK_ACTIONS: { mode: CopilotMode; label: string; icon: typeof Route }[] = [
  { mode: "explain-route", label: "Explain the predicted route", icon: Route },
  { mode: "draft-summary", label: "Draft case summary", icon: FileText },
  { mode: "next-steps", label: "Recommend next steps", icon: ListChecks },
];

interface Turn {
  id: string;
  question: string;
  answer: CopilotResponse;
}

/** Minimal markdown rendering: headings, bullets, bold — no HTML passthrough. */
function Markdown({ content }: { content: string }) {
  const blocks = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {blocks.map((line, i) => {
        const bold = (text: string) =>
          text.split(/\*\*(.+?)\*\*/g).map((part, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-foreground">
                {part}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          );

        if (line.startsWith("### ")) {
          return (
            <p key={i} className="pt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {line.slice(4)}
            </p>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="flex gap-2 text-muted-foreground">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>{bold(line.slice(2))}</span>
            </p>
          );
        }
        if (line.trim() === "") return <span key={i} className="block h-1" />;
        return (
          <p key={i} className="text-muted-foreground">
            {bold(line)}
          </p>
        );
      })}
    </div>
  );
}

export function CopilotPanel({
  investigationId,
  enabled,
  dataPolicy,
  providerLabel,
}: {
  investigationId: string;
  enabled: boolean;
  dataPolicy: string;
  providerLabel: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (input: { mode: CopilotMode; question?: string }) =>
      askCopilot({ investigationId, ...input }),
    onSuccess: (answer, input) => {
      setTurns((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          question: input.question ?? QUICK_ACTIONS.find((a) => a.mode === input.mode)?.label ?? input.mode,
          answer,
        },
      ]);
      setQuestion("");
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 10 ** 6, behavior: "smooth" }));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The copilot could not be reached"),
  });

  return (
    <ClayCard className="flex h-full min-h-[520px] flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Bot className="size-4 text-primary" />
            Investigator copilot
          </p>
          <p className="text-xs text-muted-foreground">
            Explains platform output in plain language. It cannot score risk, predict routes, or read
            a chain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={enabled ? "positive" : "neutral"} dot>
            {enabled ? providerLabel : "local briefing only"}
          </Chip>
          <Chip tone="neutral">
            <ShieldCheck className="mr-1 size-3" />
            {dataPolicy}
          </Chip>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 py-3">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.mode}
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={ask.isPending}
            onClick={() => ask.mutate({ mode: action.mode })}
          >
            <action.icon className="size-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && !ask.isPending && (
          <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            Ask a question about this investigation, or use an action above. Answers cite only what
            TRACIFY has established — if the evidence isn't there, the copilot says so instead of
            filling the gap.
          </p>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground/90">
              {turn.question}
            </p>
            <div className="rounded-xl border border-border/60 p-3">
              <Markdown content={turn.answer.content} />
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
                <Chip tone={turn.answer.fallback ? "warning" : "info"}>
                  {turn.answer.fallback
                    ? `local briefing — ${turn.answer.fallbackReason ?? "copilot unavailable"}`
                    : `${turn.answer.provider} · ${turn.answer.model}`}
                </Chip>
                <Chip tone="neutral">grounded on: {turn.answer.groundingKeys.join(", ")}</Chip>
                {turn.answer.usage?.totalTokens !== undefined && (
                  <Chip tone="neutral">{turn.answer.usage.totalTokens} tokens</Chip>
                )}
              </div>
            </div>
          </div>
        ))}

        {ask.isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Reading the evidence…
          </p>
        )}
      </div>

      <form
        className="space-y-2 border-t border-border/60 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = question.trim();
          if (trimmed.length < 3) {
            toast.error("Ask a slightly longer question");
            return;
          }
          ask.mutate({ mode: "answer", question: trimmed });
        }}
      >
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
          maxLength={1500}
          placeholder="e.g. Which exchange should we serve first, and what does the value trail support?"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Victim identity is never sent under the {dataPolicy.toLowerCase()} policy.
          </p>
          <Button type="submit" size="sm" className="gap-1.5" disabled={ask.isPending}>
            <CornerDownLeft className="size-3.5" />
            Ask
          </Button>
        </div>
      </form>
    </ClayCard>
  );
}
