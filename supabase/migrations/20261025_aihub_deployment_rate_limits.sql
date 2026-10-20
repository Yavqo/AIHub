-- Per-deployment rate limits: requests per minute and tokens per minute, counted in
-- one-minute windows. Counters are updated atomically so concurrent requests on any
-- server see the same count.

alter table public.aihub_deployments
  add column if not exists rpm_limit integer not null default 60 check (rpm_limit between 1 and 10000),
  add column if not exists tpm_limit integer not null default 200000 check (tpm_limit between 1000 and 10000000);

create table if not exists public.aihub_rate_windows (
  deployment_id uuid not null references public.aihub_deployments (id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0,
  tokens bigint not null default 0,
  primary key (deployment_id, window_start)
);

-- Server only: no client policies.
alter table public.aihub_rate_windows enable row level security;

-- Takes one request slot in the current minute if both limits allow it.
create or replace function public.aihub_rate_take(p_deployment uuid, p_rpm integer, p_tpm integer)
returns table (allowed boolean, requests integer, tokens bigint, window_start timestamptz, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_window timestamptz := date_trunc('minute', now());
  v_row public.aihub_rate_windows%rowtype;
begin
  insert into public.aihub_rate_windows as w (deployment_id, window_start, requests, tokens)
  values (p_deployment, v_window, 0, 0)
  on conflict (deployment_id, window_start) do nothing;

  select * into v_row
  from public.aihub_rate_windows w
  where w.deployment_id = p_deployment and w.window_start = v_window
  for update;

  if v_row.requests >= p_rpm or v_row.tokens >= p_tpm then
    return query select false, v_row.requests, v_row.tokens, v_window, v_window + interval '1 minute';
    return;
  end if;

  update public.aihub_rate_windows w
  set requests = w.requests + 1
  where w.deployment_id = p_deployment and w.window_start = v_window
  returning * into v_row;

  -- Keep the table small: drop this deployment's old windows.
  delete from public.aihub_rate_windows w
  where w.deployment_id = p_deployment and w.window_start < v_window - interval '5 minutes';

  return query select true, v_row.requests, v_row.tokens, v_window, v_window + interval '1 minute';
end;
$$;

-- Adds a finished request's tokens to the window it started in.
create or replace function public.aihub_rate_add_tokens(p_deployment uuid, p_window timestamptz, p_tokens integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.aihub_rate_windows w
  set tokens = w.tokens + greatest(p_tokens, 0)
  where w.deployment_id = p_deployment and w.window_start = p_window;
$$;

revoke all on function public.aihub_rate_take(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.aihub_rate_add_tokens(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.aihub_rate_take(uuid, integer, integer) to service_role;
grant execute on function public.aihub_rate_add_tokens(uuid, timestamptz, integer) to service_role;
