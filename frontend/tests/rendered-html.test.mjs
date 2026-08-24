import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const serverEntry = fileURLToPath(new URL("../.output/server/index.mjs", import.meta.url));
const port = 43_000 + (process.pid % 1_000);
const origin = `http://127.0.0.1:${port}`;
let server;
let serverError = "";

test.before(async () => {
  server = spawn(process.execPath, [serverEntry], {
    cwd: frontendRoot,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  server.stderr.setEncoding("utf8");
  server.stderr.on("data", (chunk) => { serverError += chunk; });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Nitro server exited before testing. ${serverError}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Nitro server did not become ready. ${serverError}`);
});

test.after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
});

function render(path = "/") {
  return fetch(`${origin}${path}`, { headers: { accept: "text/html" } });
}

test("server-renders the complete Electro Tech page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Powering Progress/);
  assert.match(html, /With Smarter Energy/);
  assert.match(html, /Find your solar starting point/);
  assert.match(html, /AI Solar Bill Analyzer/);
  assert.match(html, /Upload your electricity bill and get a preliminary solar system recommendation based on your actual energy consumption/);
  assert.match(html, /href="\/solar-bill-analyzer"[^>]*>Analyze My Bill/);
  assert.match(html, /Bilal Pharmacy/);
  assert.match(html, /Request My Quote/);
  assert.match(html, /Electro Tech \| Solar Energy &amp; Electrical Solutions/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("adds security headers", async () => {
  const response = await render();
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
});

test("serves public assets from the Nitro output", async () => {
  const response = await fetch(`${origin}/logos/electrotech-icon.png`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
});

test("server-renders the dedicated Solar Bill Analyzer route", async () => {
  const response = await render("/solar-bill-analyzer");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Turn your electricity usage into a practical solar starting point/);
  assert.match(html, /Upload your electricity bill/);
  assert.match(html, /Enter Consumption Manually/);
  assert.match(html, /used only to read electricity-consumption information/);
});

test("analyzer stylesheet contains narrow mobile breakpoints", async () => {
  const css = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../components/solar-bill-analyzer.module.css", import.meta.url), "utf8"));
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
