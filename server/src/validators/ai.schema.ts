import { z } from "zod";

/**
 * The copilot's only free-text input. Bounded and mode-gated: a question is
 * accepted for `answer`, while the other modes are fully server-templated so an
 * investigator cannot smuggle their own instruction block into the prompt.
 */
export const copilotSchema = z
  .object({
    mode: z.enum(["answer", "explain-route", "draft-summary", "next-steps"]).default("answer"),
    question: z.string().trim().min(3).max(1_500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "answer" && !value.question) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question"],
        message: "A question is required in answer mode",
      });
    }
  });

export type CopilotInput = z.infer<typeof copilotSchema>;
