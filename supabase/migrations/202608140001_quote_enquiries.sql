create extension if not exists pgcrypto;

create table if not exists public.quote_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 24),
  email text check (email is null or char_length(email) <= 160),
  company text check (company is null or char_length(company) <= 120),
  city text not null check (char_length(city) between 2 and 100),
  service text not null check (service in ('Solar Energy', 'Solar Structures', 'Electrical Works', 'Security Systems', 'Other Project Enquiry')),
  property_type text check (property_type is null or property_type in ('Home', 'Business', 'Institution', 'Other')),
  system_type text check (system_type is null or system_type in ('On-Grid', 'Hybrid', 'Off-Grid', 'Not Sure')),
  required_capacity text check (required_capacity is null or char_length(required_capacity) <= 80),
  monthly_bill_range text check (monthly_bill_range is null or monthly_bill_range in ('Under PKR 25,000', 'PKR 25,000–50,000', 'PKR 50,000–100,000', 'PKR 100,000+', 'Prefer not to say')),
  message text check (message is null or char_length(message) <= 1000),
  source text not null default 'website' check (source = 'website'),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now(),
  check (service <> 'Solar Energy' or (property_type is not null and system_type is not null))
);

alter table public.quote_enquiries enable row level security;
revoke all on public.quote_enquiries from anon, authenticated;

create table if not exists public.quote_rate_limits (
  client_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.quote_rate_limits enable row level security;
revoke all on public.quote_rate_limits from anon, authenticated;

create or replace function public.check_quote_rate_limit(client_hash_value text, limit_count integer, window_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.quote_rate_limits;
begin
  insert into public.quote_rate_limits (client_hash, window_started_at, request_count)
  values (client_hash_value, now(), 1)
  on conflict (client_hash) do update
    set request_count = case
      when quote_rate_limits.window_started_at < now() - make_interval(mins => window_minutes) then 1
      else quote_rate_limits.request_count + 1
    end,
    window_started_at = case
      when quote_rate_limits.window_started_at < now() - make_interval(mins => window_minutes) then now()
      else quote_rate_limits.window_started_at
    end
  returning * into current_record;
  return current_record.request_count <= limit_count;
end;
$$;

revoke all on function public.check_quote_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_quote_rate_limit(text, integer, integer) to service_role;

create index if not exists quote_enquiries_created_at_idx on public.quote_enquiries (created_at desc);
create index if not exists quote_enquiries_status_idx on public.quote_enquiries (status);
