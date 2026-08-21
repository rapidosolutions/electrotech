import { createApp } from "./app.js";
import { loadRuntimeConfig } from "./config.js";

const HOST = "0.0.0.0";
const config = loadRuntimeConfig();
const app = createApp({ config });

const server = app.listen(config.port, HOST, () => {
  console.log(`Electrotech API listening on ${HOST}:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; closing HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
