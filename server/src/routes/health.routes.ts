import { Router } from "express";
import { databaseState } from "../config/db";
import { env } from "../config/env";
import { sendSuccess } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, "VASPTRACE API is running", {
      status: "ok",
      environment: env.NODE_ENV,
      database: databaseState(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);
