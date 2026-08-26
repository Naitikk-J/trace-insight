import { Router } from "express";
import { authRouter } from "./auth.routes";
import { caseRouter } from "./case.routes";
import { dashboardRouter } from "./dashboard.routes";
import { evidenceRouter } from "./evidence.routes";
import { findingRouter } from "./finding.routes";
import { healthRouter } from "./health.routes";
import { investigationRouter } from "./investigation.routes";
import { reportRouter } from "./report.routes";
import { userRouter } from "./user.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/cases", caseRouter);
apiRouter.use("/investigations", investigationRouter);
apiRouter.use("/findings", findingRouter);
apiRouter.use("/evidence", evidenceRouter);
apiRouter.use("/reports", reportRouter);
