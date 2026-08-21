import { Router } from "express";
import { getClientIp, hashClientIp } from "../services/client-ip.js";
import { getSupabaseAdmin, type SupabaseAdmin } from "../services/supabase.js";
import { normalizePhone, quoteSchema } from "../validation/quote.js";

export const MAX_QUOTE_BODY_BYTES = 16_384;

type QuoteRouterDependencies = {
  getSupabaseAdmin?: () => SupabaseAdmin | null;
};

export function createQuoteRouter(dependencies: QuoteRouterDependencies = {}) {
  const router = Router();
  const resolveSupabase = dependencies.getSupabaseAdmin ?? getSupabaseAdmin;

  router.post("/", async (request, response) => {
    if (request.body === undefined) {
      return response.status(400).json({ message: "Invalid request." });
    }

    const parsed = quoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        message: "Please review the highlighted fields.",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const supabase = resolveSupabase();
    if (!supabase) {
      return response.status(503).json({
        message: "Online enquiries are not configured yet. Please contact us on WhatsApp.",
      });
    }

    const clientKey = hashClientIp(getClientIp(request));
    const { data: allowed, error: limitError } = await supabase.rpc("check_quote_rate_limit", {
      client_hash_value: clientKey,
      limit_count: 5,
      window_minutes: 30,
    });

    if (limitError || allowed !== true) {
      return response.status(429).json({
        message: "Too many recent requests. Please use WhatsApp or try again later.",
      });
    }

    const data = parsed.data;
    const { error } = await supabase.from("quote_enquiries").insert({
      full_name: data.fullName,
      phone: normalizePhone(data.phone),
      email: data.email,
      company: data.company,
      city: data.city,
      service: data.service,
      property_type: data.propertyType,
      system_type: data.systemType,
      required_capacity: data.requiredCapacity,
      monthly_bill_range: data.monthlyBillRange,
      message: data.message,
    });

    if (error) {
      return response.status(500).json({
        message: "We couldn't submit your enquiry. Please try again or contact us on WhatsApp.",
      });
    }

    return response.json({ ok: true });
  });

  return router;
}
