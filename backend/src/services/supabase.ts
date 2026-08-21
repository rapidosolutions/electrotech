import { createClient } from "@supabase/supabase-js";

export type RateLimitArguments = {
  client_hash_value: string;
  limit_count: number;
  window_minutes: number;
};

export type QuoteInsert = {
  full_name: string;
  phone: string;
  email?: string | undefined;
  company?: string | undefined;
  city: string;
  service: string;
  property_type?: string | undefined;
  system_type?: string | undefined;
  required_capacity?: string | undefined;
  monthly_bill_range?: string | undefined;
  message?: string | undefined;
};

export type SupabaseAdmin = {
  rpc(
    name: "check_quote_rate_limit",
    arguments_: RateLimitArguments,
  ): PromiseLike<{ data: boolean | null; error: unknown }>;
  from(name: "quote_enquiries"): {
    insert(values: QuoteInsert): PromiseLike<{ error: unknown }>;
  };
};

export function getSupabaseAdmin(): SupabaseAdmin | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseAdmin;
}
