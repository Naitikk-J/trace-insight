import { Router } from "express";
import * as ai from "../controllers/ai.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { heavyLimiter } from "../middleware/security.middleware";
import { objectIdParam, validate } from "../middleware/validate.middleware";
import { copilotSchema } from "../validators/ai.schema";

export const aiRouter = Router();

// Both AI systems read case-scoped evidence, so a session is mandatory.
aiRouter.use(requireAuth);

aiRouter.get("/status", ai.status);

// Scoring is CPU-bound; copilot calls leave the process and cost money.
aiRouter.post(
  "/investigations/:id/route-prediction",
  heavyLimiter,
  validate({ params: objectIdParam }),
  ai.predictRoutes,
);

aiRouter.post(
  "/investigations/:id/copilot",
  heavyLimiter,
  validate({ params: objectIdParam, body: copilotSchema }),
  ai.copilot,
);
