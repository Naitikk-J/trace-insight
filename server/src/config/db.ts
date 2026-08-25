import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Connect to MongoDB. Rejects on failure so the caller can abort startup —
 * the API must never silently run without a database.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !env.isProduction,
    })
    .then((conn) => {
      const { host, name } = conn.connection;
      console.log(`[VASPTRACE] MongoDB connected — host=${host} db=${name}`);
      return conn;
    })
    .catch((error: unknown) => {
      connecting = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`MongoDB connection failed: ${message}`);
    });

  mongoose.connection.on("error", (error) => {
    console.error("[VASPTRACE] MongoDB error:", error.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[VASPTRACE] MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[VASPTRACE] MongoDB reconnected");
  });

  return connecting;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  connecting = null;
  console.log("[VASPTRACE] MongoDB connection closed");
}

export function databaseState(): "disconnected" | "connected" | "connecting" | "disconnecting" | "unknown" {
  switch (mongoose.connection.readyState) {
    case 0:
      return "disconnected";
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "unknown";
  }
}
