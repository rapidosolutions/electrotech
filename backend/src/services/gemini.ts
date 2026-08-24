import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { billExtractionSchema, type BillExtraction } from "../validation/solar-analyzer.js";

export const GEMINI_EXTRACTION_TIMEOUT_MS = 20_000;

const EXTRACTION_PROMPT = `You are reading a Pakistani electricity bill only to extract non-personal energy-use data.
Return only the requested JSON structure. Never calculate or recommend a solar system.

Rules:
- Extract only information visible in the bill.
- Use null for missing or unreadable values. Never invent months or infer unseen consumption.
- Preserve the printed month/year relationship.
- Interpret "units" as kWh only when the bill context supports it.
- Mark ambiguous readings with low or medium confidence and list the affected field in uncertainFields.
- Do not return customer name, account/reference number, meter number, consumer number, phone, CNIC, or a street address.
- A city may be returned only when clearly printed or unambiguously identified by the electricity provider/region.
- Normalize phase only to "single", "three", or null.`;

export type ExtractableBill = {
  bytes: Buffer;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
};

export class GeminiExtractionError extends Error {
  constructor(
    public readonly code: "not_configured" | "timeout" | "rate_limited" | "unavailable" | "invalid_output" | "unreadable",
    message: string,
  ) {
    super(message);
    this.name = "GeminiExtractionError";
  }
}

export function parseGeminiExtraction(value: unknown): BillExtraction {
  const parsed = billExtractionSchema.safeParse(value);
  if (!parsed.success) {
    throw new GeminiExtractionError("invalid_output", "The bill reader returned an invalid response.");
  }
  if (
    parsed.data.monthlyConsumption.length === 0 &&
    parsed.data.currentMonthConsumptionKwh === null
  ) {
    throw new GeminiExtractionError("unreadable", "No readable consumption data was found in this bill.");
  }
  return parsed.data;
}

export async function extractBillWithGemini(file: ExtractableBill): Promise<BillExtraction> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || !model) {
    throw new GeminiExtractionError("not_configured", "Bill extraction is not configured.");
  }
  if (model.endsWith("-latest")) {
    throw new GeminiExtractionError("not_configured", "GEMINI_MODEL must use a stable model identifier.");
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { data: file.bytes.toString("base64"), mimeType: file.mimeType } },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(billExtractionSchema),
        temperature: 0,
        httpOptions: { timeout: GEMINI_EXTRACTION_TIMEOUT_MS },
      },
    });

    const text = response.text?.trim();
    if (!text) throw new GeminiExtractionError("unreadable", "No readable bill data was returned.");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new GeminiExtractionError("invalid_output", "The bill reader returned malformed data.");
    }
    return parseGeminiExtraction(json);
  } catch (error) {
    if (error instanceof GeminiExtractionError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (/timeout|timed out|deadline|aborted/.test(message)) {
      throw new GeminiExtractionError("timeout", "Bill extraction timed out.");
    }
    if (/429|rate.?limit|resource_exhausted/.test(message)) {
      throw new GeminiExtractionError("rate_limited", "The bill reader is temporarily busy.");
    }
    throw new GeminiExtractionError("unavailable", "Bill extraction is temporarily unavailable.");
  }
}
