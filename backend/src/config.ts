const LOCAL_PORT = 3001;

export type RuntimeConfig = {
  nodeEnv: string;
  frontendOrigin?: string;
  port: number;
};

function parsePort(value: string | undefined): number {
  if (!value) return LOCAL_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function parseOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const url = new URL(value);
  if (url.origin !== value || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("FRONTEND_ORIGIN must be a complete origin without a path.");
  }

  return url.origin;
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = environment.NODE_ENV || "development";
  const frontendOrigin = parseOrigin(environment.FRONTEND_ORIGIN);

  if (nodeEnv === "production" && !frontendOrigin) {
    throw new Error("FRONTEND_ORIGIN is required when NODE_ENV=production.");
  }

  return {
    nodeEnv,
    port: parsePort(environment.PORT),
    ...(frontendOrigin ? { frontendOrigin } : {}),
  };
}
