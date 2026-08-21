import cors, { type CorsOptions } from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import type { RuntimeConfig } from "./config.js";
import { createQuoteRouter, MAX_QUOTE_BODY_BYTES } from "./routes/quote.js";
import type { SupabaseAdmin } from "./services/supabase.js";

type AppDependencies = {
  config: Pick<RuntimeConfig, "nodeEnv" | "frontendOrigin">;
  getSupabaseAdmin?: () => SupabaseAdmin | null;
};

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function createCorsOptions(config: AppDependencies["config"]): CorsOptions {
  return {
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.frontendOrigin && origin === config.frontendOrigin) return callback(null, true);
      if (config.nodeEnv !== "production" && isLocalDevelopmentOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed."));
    },
  };
}

const quoteContentLengthGuard: RequestHandler = (request, response, next) => {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > MAX_QUOTE_BODY_BYTES) {
    response.status(413).json({ message: "Request is too large." });
    return;
  }
  next();
};

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  // Belmo routes edge traffic directly through one load balancer hop.
  app.set("trust proxy", 1);
  app.use(cors(createCorsOptions(dependencies.config)));
  app.get("/api/health", (_request, response) => response.status(200).json({ ok: true }));
  app.use("/api/quote", quoteContentLengthGuard);
  app.use(express.json({ limit: MAX_QUOTE_BODY_BYTES }));
  app.use(
    "/api/quote",
    createQuoteRouter(
      dependencies.getSupabaseAdmin
        ? { getSupabaseAdmin: dependencies.getSupabaseAdmin }
        : {},
    ),
  );

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    const bodyError = error as { status?: number; type?: string };
    if (bodyError.status === 413 || bodyError.type === "entity.too.large") {
      response.status(413).json({ message: "Request is too large." });
      return;
    }
    if (bodyError.status === 400 || bodyError.type === "entity.parse.failed") {
      response.status(400).json({ message: "Invalid request." });
      return;
    }
    if (error instanceof Error && error.message === "Origin is not allowed.") {
      response.status(403).json({ message: "Origin is not allowed." });
      return;
    }

    console.error("Unhandled API error", error);
    response.status(500).json({ message: "Internal server error." });
  };

  app.use(errorHandler);
  return app;
}
