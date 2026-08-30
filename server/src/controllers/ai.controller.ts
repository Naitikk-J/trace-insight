import { currentUser } from "../middleware/auth.middleware";
import { copilotForInvestigation, predictInvestigationRoutes } from "../services/ai.service";
import { llmStatus } from "../services/llm";
import { mlStatus } from "../services/ml";
import type { CopilotInput } from "../validators/ai.schema";
import { sendSuccess } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Which AI systems are active, and — just as importantly — what each is not
 * allowed to do. The UI renders this verbatim so an investigator always knows
 * whether a number came from the platform model or a third-party model.
 */
export const status = asyncHandler(async (_req, res) => {
  sendSuccess(res, "AI systems status", {
    riskModel: await mlStatus(),
    copilot: llmStatus(),
    boundary: {
      riskModel: "Scores and ranks candidate money routes from observed chain data.",
      copilot: "Explains platform output in investigator language. Never scores, traces, or predicts.",
    },
  });
});

/** AI System 1 — predicted money route for a stored investigation. */
export const predictRoutes = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { id: string };
  sendSuccess(
    res,
    "Predicted money route",
    await predictInvestigationRoutes(params.id, currentUser(req)),
  );
});

/** AI System 2 — grounded copilot turn for a stored investigation. */
export const copilot = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { id: string };
  const body = req.body as CopilotInput;
  sendSuccess(
    res,
    "Copilot response",
    await copilotForInvestigation(params.id, currentUser(req), {
      mode: body.mode,
      ...(body.question ? { question: body.question } : {}),
    }),
  );
});
