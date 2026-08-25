import cors from "cors";
import express, { type Express } from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/notFound.middleware";
import { apiRouter } from "./routes";
import { ApiError } from "./utils/ApiError";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin/tooling requests without an Origin header.
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(ApiError.forbidden(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) {
    app.use(morgan("dev"));
  }

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
