import type { Server } from "node:http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/db";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
  } catch (error) {
    console.error(
      `[VASPTRACE] Startup aborted — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    console.log(
      `[VASPTRACE] API listening on http://localhost:${env.PORT}/api (env=${env.NODE_ENV})`,
    );
  });

  const shutdown = (signal: string) => {
    console.log(`[VASPTRACE] ${signal} received — shutting down`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Don't hang forever on stuck connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("[VASPTRACE] Unhandled rejection:", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[VASPTRACE] Uncaught exception:", error);
    shutdown("uncaughtException");
  });
}

void bootstrap();
