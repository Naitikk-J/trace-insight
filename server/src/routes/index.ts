import { Router } from "express";
import { healthRouter } from "./health.routes";

/**
 * Root API router. Feature routers (auth, cases, investigations, findings,
 * evidence, reports) mount here as each phase lands.
 */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
