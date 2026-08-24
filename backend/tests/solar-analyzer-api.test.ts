import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import { createApp } from "../src/app.js";
import { MAX_BILL_FILE_BYTES } from "../src/services/bill-upload.js";
import { GeminiExtractionError, parseGeminiExtraction } from "../src/services/gemini.js";
import type { SupabaseAdmin } from "../src/services/supabase.js";
import type { BillExtraction } from "../src/validation/solar-analyzer.js";

const servers = new Set<Server>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  servers.clear();
});

const extraction: BillExtraction = {
  provider: "IESCO",
  city: "Islamabad",
  connectionType: "Residential",
  phase: "single",
  sanctionedLoadKw: 5,
  consumerCategory: "A-1",
  currentMonthConsumptionKwh: 420,
  currentBillAmountPkr: 24_000,
  monthlyConsumption: Array.from({ length: 12 }, (_, index) => ({ year: 2026, month: index + 1, kwh: 400 + index, confidence: "high" as const })),
  uncertainFields: [],
};

function fakeSupabase(allowed = true): SupabaseAdmin {
  return {
    rpc: async () => ({ data: allowed, error: null }),
    from: () => ({ insert: async () => ({ error: null }) }),
  } as unknown as SupabaseAdmin;
}

async function startApi(options: { allowed?: boolean; extractBill?: () => Promise<BillExtraction> } = {}) {
  const app = createApp({
    config: { nodeEnv: "test", frontendOrigin: "http://localhost:3000" },
    getSupabaseAdmin: () => fakeSupabase(options.allowed ?? true),
    ...(options.extractBill ? { extractBill: options.extractBill } : { extractBill: async () => extraction }),
  });
  const server = app.listen(0, "127.0.0.1");
  servers.add(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function formFor(name: string, type: string, bytes: Uint8Array): FormData {
  const form = new FormData();
  form.set("bill", new File([bytes.slice().buffer as ArrayBuffer], name, { type }));
  return form;
}

const pdf = new TextEncoder().encode("%PDF-1.7\nminimal-test");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

test("accepts validated PDF, JPEG and PNG uploads with mocked Gemini extraction", async () => {
  for (const [name, type, bytes] of [
    ["bill.pdf", "application/pdf", pdf],
    ["bill.jpg", "image/jpeg", jpeg],
    ["bill.png", "image/png", png],
  ] as const) {
    const baseUrl = await startApi();
    const response = await fetch(`${baseUrl}/api/solar-analyzer/extract`, { method: "POST", body: formFor(name, type, bytes) });
    assert.equal(response.status, 200);
    const body = await response.json() as { extraction: BillExtraction; billAnalysisConfidence: string };
    assert.equal(body.extraction.provider, "IESCO");
    assert.equal(body.billAnalysisConfidence, "High");
  }
});

test("rejects unsupported, signature-mismatched and oversized uploads", async () => {
  const baseUrl = await startApi();
  const unsupported = await fetch(`${baseUrl}/api/solar-analyzer/extract`, { method: "POST", body: formFor("bill.txt", "text/plain", pdf) });
  assert.equal(unsupported.status, 415);

  const mismatch = await fetch(`${baseUrl}/api/solar-analyzer/extract`, { method: "POST", body: formFor("bill.pdf", "application/pdf", png) });
  assert.equal(mismatch.status, 415);

  const oversized = await fetch(`${baseUrl}/api/solar-analyzer/extract`, {
    method: "POST",
    body: formFor("bill.pdf", "application/pdf", new Uint8Array(MAX_BILL_FILE_BYTES + 1).fill(1).map((value, index) => index < pdf.length ? pdf[index]! : value)),
  });
  assert.equal(oversized.status, 413);
});

test("rejects missing and malformed multipart requests safely", async () => {
  const baseUrl = await startApi();
  const missing = await fetch(`${baseUrl}/api/solar-analyzer/extract`, { method: "POST", body: new FormData() });
  assert.equal(missing.status, 400);
  const malformed = await fetch(`${baseUrl}/api/solar-analyzer/extract`, {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=broken" },
    body: "--broken\r\nContent-Disposition: form-data; name=\"bill\"; filename=\"bill.pdf\"",
  });
  assert.equal(malformed.status, 400);
});

test("maps mocked Gemini timeout and invalid-output failures to safe responses", async () => {
  const timeoutUrl = await startApi({ extractBill: async () => { throw new GeminiExtractionError("timeout", "private detail"); } });
  const timeout = await fetch(`${timeoutUrl}/api/solar-analyzer/extract`, { method: "POST", body: formFor("bill.pdf", "application/pdf", pdf) });
  assert.equal(timeout.status, 504);
  assert.doesNotMatch(JSON.stringify(await timeout.json()), /private detail/);

  assert.throws(() => parseGeminiExtraction({ provider: "IESCO" }), /invalid response/);
});

test("strips PII and preserves missing and uncertain extraction values", () => {
  const parsed = parseGeminiExtraction({
    ...extraction,
    customerName: "Must not leave server validation",
    accountNumber: "Must not leave server validation",
    provider: null,
    monthlyConsumption: [{ year: 2026, month: 1, kwh: null, confidence: "low" }],
    currentMonthConsumptionKwh: 420,
    uncertainFields: ["monthlyConsumption.0.kwh"],
  });
  assert.equal("customerName" in parsed, false);
  assert.equal("accountNumber" in parsed, false);
  assert.equal(parsed.provider, null);
  assert.equal(parsed.monthlyConsumption[0]?.kwh, null);
});

test("enforces namespaced database rate limiting before paid extraction", async () => {
  let extractorCalled = false;
  const baseUrl = await startApi({ allowed: false, extractBill: async () => { extractorCalled = true; return extraction; } });
  const response = await fetch(`${baseUrl}/api/solar-analyzer/extract`, { method: "POST", body: formFor("bill.pdf", "application/pdf", pdf) });
  assert.equal(response.status, 429);
  assert.equal(extractorCalled, false);
});

test("calculates from verified non-PII JSON and validates bad requests", async () => {
  const baseUrl = await startApi();
  const valid = await fetch(`${baseUrl}/api/solar-analyzer/calculate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "Islamabad", monthlyConsumption: extraction.monthlyConsumption }),
  });
  assert.equal(valid.status, 200);
  const result = await valid.json() as { bestMatch: { architecture: string }; systems: { onGrid: { nominalPvKwp: number } } };
  assert.equal(result.bestMatch.architecture, "On-Grid");
  assert.ok(result.systems.onGrid.nominalPvKwp >= 5);

  const invalid = await fetch(`${baseUrl}/api/solar-analyzer/calculate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ city: "", monthlyConsumption: [] }),
  });
  assert.equal(invalid.status, 400);
});
