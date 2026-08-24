import type { SupabaseAdmin } from "./supabase.js";

export const ANALYZER_RATE_LIMITS = Object.freeze({
  extract: { action: "solar_bill_extract" as const, limitCount: 3, windowMinutes: 30 },
  calculate: { action: "solar_bill_calculate" as const, limitCount: 20, windowMinutes: 30 },
});

export async function checkAnalyzerRateLimit(
  supabase: SupabaseAdmin,
  action: "solar_bill_extract" | "solar_bill_calculate",
  clientHash: string,
  limitCount: number,
  windowMinutes: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_api_action_rate_limit", {
    action_name_value: action,
    client_hash_value: clientHash,
    limit_count: limitCount,
    window_minutes: windowMinutes,
  });
  return !error && data === true;
}
