import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizePhone, quoteSchema } from "@/lib/validation";

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ message: "Request is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const parsed = quoteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Please review the highlighted fields.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { message: "Online enquiries are not configured yet. Please contact us on WhatsApp." },
      { status: 503 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = await hash(forwarded || request.headers.get("cf-connecting-ip") || "unknown");
  const { data: allowed, error: limitError } = await supabase.rpc("check_quote_rate_limit", {
    client_hash_value: clientKey,
    limit_count: 5,
    window_minutes: 30,
  });

  if (limitError || allowed !== true) {
    return NextResponse.json(
      { message: "Too many recent requests. Please use WhatsApp or try again later." },
      { status: 429 },
    );
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
    return NextResponse.json(
      { message: "We couldn't submit your enquiry. Please try again or contact us on WhatsApp." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
