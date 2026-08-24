import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete Electro Tech page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Powering Progress/);
  assert.match(html, /With Smarter Energy/);
  assert.match(html, /Find your solar starting point/);
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
