create table if not exists public.api_action_rate_limits (
  action_name text not null check (char_length(action_name) between 3 and 80),
  client_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (action_name, client_hash)
);

alter table public.api_action_rate_limits enable row level security;
revoke all on public.api_action_rate_limits from anon, authenticated;

create or replace function public.check_api_action_rate_limit(
  action_name_value text,
  client_hash_value text,
  limit_count integer,
  window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.api_action_rate_limits;
begin
  if action_name_value not in ('solar_bill_extract', 'solar_bill_calculate') then
    return false;
  end if;

  insert into public.api_action_rate_limits (action_name, client_hash, window_started_at, request_count)
  values (action_name_value, client_hash_value, now(), 1)
  on conflict (action_name, client_hash) do update
    set request_count = case
      when api_action_rate_limits.window_started_at < now() - make_interval(mins => window_minutes) then 1
      else api_action_rate_limits.request_count + 1
    end,
    window_started_at = case
      when api_action_rate_limits.window_started_at < now() - make_interval(mins => window_minutes) then now()
      else api_action_rate_limits.window_started_at
    end
  returning * into current_record;

  return current_record.request_count <= limit_count;
end;
$$;

revoke all on function public.check_api_action_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_api_action_rate_limit(text, text, integer, integer) to service_role;

create index if not exists api_action_rate_limits_window_idx
  on public.api_action_rate_limits (window_started_at);
