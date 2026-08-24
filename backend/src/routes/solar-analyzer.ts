import { Router } from "express";
import multer from "multer";
import { validateBillUpload } from "../services/bill-upload.js";
import { extractBillWithGemini, GeminiExtractionError, type ExtractableBill } from "../services/gemini.js";
import { getClientIp, hashClientIp } from "../services/client-ip.js";
import { ANALYZER_RATE_LIMITS, checkAnalyzerRateLimit } from "../services/rate-limit.js";
import { calculateSolarRecommendation } from "../services/solar/calculator.js";
import { getSupabaseAdmin, type SupabaseAdmin } from "../services/supabase.js";
import { assessDataConfidence, type BillExtraction, verifiedSolarInputSchema } from "../validation/solar-analyzer.js";

export const MAX_CALCULATE_BODY_BYTES = 32_768;

export type SolarAnalyzerRouterDependencies = {
  getSupabaseAdmin?: () => SupabaseAdmin | null;
  extractBill?: (file: ExtractableBill) => Promise<BillExtraction>;
};

const billUpload = multer({
  storage: multer.memoryStorage(),
  // Busboy checks the parts limit before yielding the final permitted part;
  // allow its terminal boundary while still accepting one file and zero fields.
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
});

function extractionErrorResponse(error: GeminiExtractionError) {
  if (error.code === "timeout") return { status: 504, message: "Bill extraction timed out. Please retry or enter consumption manually." };
  if (error.code === "rate_limited") return { status: 503, message: "Bill extraction is temporarily busy. Please retry shortly or enter consumption manually." };
  if (error.code === "invalid_output") return { status: 502, message: "The bill could not be read reliably. Try the original PDF or enter consumption manually." };
  if (error.code === "unreadable") return { status: 422, message: "No readable consumption data was found. Upload a clearer bill or enter consumption manually." };
  return { status: 503, message: "Bill extraction is temporarily unavailable. You can enter consumption manually." };
}

export function createSolarAnalyzerRouter(dependencies: SolarAnalyzerRouterDependencies = {}) {
  const router = Router();
  const resolveSupabase = dependencies.getSupabaseAdmin ?? getSupabaseAdmin;
  const extractBill = dependencies.extractBill ?? extractBillWithGemini;

  router.post("/extract", billUpload.single("bill"), async (request, response) => {
    if (!request.file) {
      return response.status(400).json({ code: "missing_file", message: "Choose one electricity bill to upload." });
    }

    let file: ExtractableBill;
    try {
      file = validateBillUpload(request.file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid bill upload.";
      return response.status(415).json({ code: "invalid_file", message });
    }

    const supabase = resolveSupabase();
    if (!supabase) {
      return response.status(503).json({ code: "rate_limit_unavailable", message: "Bill analysis is not configured yet. Enter consumption manually or try again later." });
    }
    const limit = ANALYZER_RATE_LIMITS.extract;
    const allowed = await checkAnalyzerRateLimit(supabase, limit.action, hashClientIp(getClientIp(request)), limit.limitCount, limit.windowMinutes);
    if (!allowed) {
      return response.status(429).json({ code: "rate_limited", message: "Too many bill-analysis attempts. Enter consumption manually or try again later." });
    }

    try {
      const extraction = await extractBill(file);
      return response.json({ extraction, ...assessDataConfidence(extraction.monthlyConsumption, extraction.uncertainFields) });
    } catch (error) {
      if (error instanceof GeminiExtractionError) {
        const safe = extractionErrorResponse(error);
        return response.status(safe.status).json({ code: error.code, message: safe.message });
      }
      console.error("Unexpected bill extraction error", error);
      return response.status(503).json({ code: "unavailable", message: "Bill extraction is temporarily unavailable. You can enter consumption manually." });
    }
  });

  router.post("/calculate", async (request, response) => {
    const parsed = verifiedSolarInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        code: "invalid_verified_data",
        message: "Review the verified consumption and location fields.",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const supabase = resolveSupabase();
    if (!supabase) {
      return response.status(503).json({ code: "rate_limit_unavailable", message: "Solar calculations are not configured yet. Please try again later." });
    }
    const limit = ANALYZER_RATE_LIMITS.calculate;
    const allowed = await checkAnalyzerRateLimit(supabase, limit.action, hashClientIp(getClientIp(request)), limit.limitCount, limit.windowMinutes);
    if (!allowed) {
      return response.status(429).json({ code: "rate_limited", message: "Too many calculation requests. Please try again later." });
    }

    return response.json(calculateSolarRecommendation(parsed.data));
  });

  return router;
}
