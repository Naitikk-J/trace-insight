import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { casesQuery, createInvestigation } from "@/lib/api/queries";
import { BLOCKCHAINS } from "@/lib/domain";
import { useUIStore } from "@/stores/ui";

const schema = z.object({
  case_id: z.string().uuid("Select the case this investigation belongs to."),
  name: z.string().min(6, "Name the investigation (min 6 chars)."),
  description: z.string().max(2000).optional(),
  target_address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid EVM address (0x + 40 hex chars)."),
  blockchain: z.string().min(1),
  trace_depth: z.number().min(1).max(6),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  min_value: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function StartInvestigationDialog({
  presetCaseId,
}: {
  presetCaseId?: string | undefined;
}) {
  const open = useUIStore((s) => s.startInvestigationOpen);
  const setOpen = useUIStore((s) => s.setStartInvestigationOpen);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: cases } = useQuery({ ...casesQuery(), enabled: open });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      case_id: presetCaseId ?? "",
      name: "",
      description: "",
      target_address: "",
      blockchain: "ethereum",
      trace_depth: 3,
      window_start: "",
      window_end: "",
      min_value: "",
    },
  });

  useEffect(() => {
    if (open && presetCaseId) form.setValue("case_id", presetCaseId);
  }, [open, presetCaseId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createInvestigation({
        case_id: values.case_id,
        name: values.name,
        description: values.description || undefined,
        target_address: values.target_address.toLowerCase(),
        blockchain: values.blockchain,
        trace_depth: values.trace_depth,
        window_start: values.window_start
          ? new Date(values.window_start).toISOString()
          : null,
        window_end: values.window_end
          ? new Date(values.window_end).toISOString()
          : null,
        min_value: values.min_value ? Number(values.min_value) : null,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
      toast.success(`${created.investigation_ref} queued for tracing`);
      setOpen(false);
      form.reset();
      void navigate({
        to: "/investigations/$investigationId",
        params: { investigationId: created.id },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const depth = form.watch("trace_depth");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="size-4 text-primary" />
            Start an investigation
          </DialogTitle>
          <DialogDescription>
            The trace is bounded by hop depth, time window and value threshold so
            the investigation graph stays interpretable.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
          >
            <FormField
              control={form.control}
              name="case_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent case</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a case" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(cases ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.case_ref} — {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target wallet address</FormLabel>
                  <FormControl>
                    <Input
                      className="mono"
                      placeholder="0x7f3a9c41d8b2e6a05c19fd4b7e82a1c60d5f93ab"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The victim-reported or suspect wallet the trace starts from.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="blockchain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BLOCKCHAINS.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            disabled={!c.supported}
                          >
                            {c.label}
                            {c.supported ? "" : " — ingestion pending"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investigation name</FormLabel>
                    <FormControl>
                      <Input placeholder="Drainer wallet — 4 hop trace" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="trace_depth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Trace depth
                    <span className="mono ml-2 text-primary">{depth} hops</span>
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={6}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0] ?? 3)}
                      className="pt-2"
                    />
                  </FormControl>
                  <FormDescription>
                    Deeper traces widen the graph exponentially. 3–4 hops is
                    typical for a first pass.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investigative objective</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="What question should this trace answer?"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Accordion type="single" collapsible>
              <AccordionItem value="advanced" className="border-border">
                <AccordionTrigger className="text-sm">
                  Advanced parameters
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="window_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Window start</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="window_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Window end</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="min_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum transaction value</FormLabel>
                        <FormControl>
                          <Input
                            className="mono"
                            inputMode="decimal"
                            placeholder="500"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Filters dust and decoy transfers out of the graph.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Queueing…" : "Queue trace"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
