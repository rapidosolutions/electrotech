import { z } from "zod";

export const readingConfidenceSchema = z.enum(["high", "medium", "low"]);

export const monthlyConsumptionSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  kwh: z.number().finite().nonnegative().max(10_000_000).nullable(),
  confidence: readingConfidenceSchema,
});

export const billExtractionSchema = z.object({
  provider: z.string().trim().max(120).nullable(),
  city: z.string().trim().max(100).nullable(),
  connectionType: z.string().trim().max(80).nullable(),
  phase: z.enum(["single", "three"]).nullable(),
  sanctionedLoadKw: z.number().finite().nonnegative().max(10_000).nullable(),
  consumerCategory: z.string().trim().max(100).nullable(),
  currentMonthConsumptionKwh: z.number().finite().nonnegative().max(10_000_000).nullable(),
  currentBillAmountPkr: z.number().finite().nonnegative().max(1_000_000_000).nullable(),
  monthlyConsumption: z.array(monthlyConsumptionSchema).max(12),
  uncertainFields: z.array(z.string().trim().min(1).max(120)).max(30),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;
export type ReadingConfidence = z.infer<typeof readingConfidenceSchema>;

export const verifiedSolarInputSchema = z.object({
  provider: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(2).max(100),
  connectionType: z.string().trim().max(80).nullable().optional(),
  phase: z.enum(["single", "three"]).nullable().optional(),
  sanctionedLoadKw: z.number().finite().nonnegative().max(10_000).nullable().optional(),
  monthlyConsumption: z.array(monthlyConsumptionSchema).min(1).max(12),
  backupPreference: z.object({
    level: z.enum(["essential", "most", "entire"]),
    durationHours: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
    backupLoadKw: z.number().finite().positive().max(10_000).nullable().optional(),
  }).optional(),
});

export type VerifiedSolarInput = z.infer<typeof verifiedSolarInputSchema>;

export const CONFIDENCE_THRESHOLDS = Object.freeze({
  highMinimumReadableMonths: 11,
  highMaximumUncertainMonths: 1,
  mediumMinimumReadableMonths: 6,
});

export type BillAnalysisConfidence = "High" | "Medium" | "Low";
export type RecommendationDataStatus = "Complete" | "Incomplete";

export function assessDataConfidence(
  monthlyConsumption: BillExtraction["monthlyConsumption"],
  uncertainFields: readonly string[] = [],
): {
  billAnalysisConfidence: BillAnalysisConfidence;
  recommendationData: RecommendationDataStatus;
} {
  const readable = monthlyConsumption.filter((reading) => reading.kwh !== null);
  const uniqueReadableMonths = new Set(readable.map((reading) => `${reading.year}-${reading.month}`)).size;
  const uncertainMonths = readable.filter((reading) => reading.confidence !== "high").length;
  const significantUncertainty = uncertainFields.some((field) =>
    /consumption|units|month|year|location|city/i.test(field),
  );

  let billAnalysisConfidence: BillAnalysisConfidence = "Low";
  if (
    uniqueReadableMonths >= CONFIDENCE_THRESHOLDS.highMinimumReadableMonths &&
    uncertainMonths <= CONFIDENCE_THRESHOLDS.highMaximumUncertainMonths &&
    !significantUncertainty
  ) {
    billAnalysisConfidence = "High";
  } else if (uniqueReadableMonths >= CONFIDENCE_THRESHOLDS.mediumMinimumReadableMonths) {
    billAnalysisConfidence = "Medium";
  }

  return {
    billAnalysisConfidence,
    recommendationData: uniqueReadableMonths === 12 ? "Complete" : "Incomplete",
  };
}
