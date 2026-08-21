import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import type { SupabaseAdmin } from "../src/services/supabase.js";

const servers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.clear();
});

async function startApi(options: {
  nodeEnv?: string;
  frontendOrigin?: string;
  getSupabaseAdmin?: () => SupabaseAdmin | null;
} = {}) {
  const config = {
    nodeEnv: options.nodeEnv ?? "test",
    ...(options.frontendOrigin ? { frontendOrigin: options.frontendOrigin } : {}),
  };
  const app = createApp({
    config,
    ...(options.getSupabaseAdmin ? { getSupabaseAdmin: options.getSupabaseAdmin } : {}),
  });
  const server = app.listen(0, "127.0.0.1");
  servers.add(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

const validQuote = {
  fullName: "Test Customer",
  phone: "0092 (310) 505-6394",
  city: "Attock",
  service: "Solar Energy",
  email: "CUSTOMER@EXAMPLE.COM",
  company: "",
  propertyType: "Home",
  systemType: "Hybrid",
  requiredCapacity: "10 kW",
  monthlyBillRange: "PKR 25,000–50,000",
  message: "Please contact me.",
  website: "",
};

test("GET /api/health returns HTTP 200", async () => {
  const baseUrl = await startApi();
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("POST /api/quote preserves validation and honeypot behavior", async () => {
  const baseUrl = await startApi();
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validQuote, website: "spam.example" }),
  });
  const body = (await response.json()) as { message: string; issues: Record<string, string[]> };
  assert.equal(response.status, 400);
  assert.equal(body.message, "Please review the highlighted fields.");
  assert.deepEqual(body.issues.website, ["Invalid submission"]);
});

test("POST /api/quote rejects malformed and oversized JSON", async () => {
  const baseUrl = await startApi();
  const malformed = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { message: "Invalid request." });

  const oversized = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(17_000) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { message: "Request is too large." });
});

test("POST /api/quote returns 503 when Supabase is not configured", async () => {
  const baseUrl = await startApi({ getSupabaseAdmin: () => null });
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validQuote),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    message: "Online enquiries are not configured yet. Please contact us on WhatsApp.",
  });
});

test("POST /api/quote preserves rate-limit parameters, IP hashing, normalization, and insert shape", async () => {
  let rpcArguments: Record<string, unknown> | undefined;
  let inserted: Record<string, unknown> | undefined;
  const fakeSupabase = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rpcArguments = args;
      return { data: true, error: null };
    },
    from: (table: string) => {
      assert.equal(table, "quote_enquiries");
      return {
      insert: async (values: Record<string, unknown>) => {
        inserted = values;
        return { error: null };
      },
      };
    },
  } as unknown as SupabaseAdmin;

  const baseUrl = await startApi({ getSupabaseAdmin: () => fakeSupabase });
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.42",
    },
    body: JSON.stringify(validQuote),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(rpcArguments, {
    client_hash_value: createHash("sha256").update("198.51.100.42").digest("hex"),
    limit_count: 5,
    window_minutes: 30,
  });
  assert.equal(inserted?.phone, "+923105056394");
  assert.equal(inserted?.email, "customer@example.com");
  assert.equal("website" in (inserted ?? {}), false);
});

test("production CORS permits only the configured frontend origin", async () => {
  const baseUrl = await startApi({
    nodeEnv: "production",
    frontendOrigin: "https://electrotech-frontend.example",
  });

  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: "https://electrotech-frontend.example" },
  });
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://electrotech-frontend.example",
  );

  const preflight = await fetch(`${baseUrl}/api/quote`, {
    method: "OPTIONS",
    headers: {
      origin: "https://electrotech-frontend.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://electrotech-frontend.example",
  );

  const rejected = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
});

test("POST /api/quote preserves the database rate-limit rejection", async () => {
  let insertCalled = false;
  const fakeSupabase = {
    rpc: async () => ({ data: false, error: null }),
    from: () => ({
      insert: async () => {
        insertCalled = true;
        return { error: null };
      },
    }),
  } as unknown as SupabaseAdmin;

  const baseUrl = await startApi({ getSupabaseAdmin: () => fakeSupabase });
  const response = await fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validQuote),
  });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    message: "Too many recent requests. Please use WhatsApp or try again later.",
  });
  assert.equal(insertCalled, false);
});
