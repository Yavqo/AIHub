-- Deployments (a project's own instance of a base model with its own endpoint and
-- defaults) and per-token billing in EUR.

-- Prices per 1M tokens, in EUR.
alter table public.aihub_models
  add column if not exists input_price_per_mtok numeric(10, 4) not null default 2.50,
  add column if not exists output_price_per_mtok numeric(10, 4) not null default 10.00,
  add column if not exists currency text not null default 'EUR';

update public.aihub_models
set input_price_per_mtok = 2.50, output_price_per_mtok = 10.00, currency = 'EUR'
where id = 'sunlight-2-pro';

create table if not exists public.aihub_deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.aihub_projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  base_model_id text not null references public.aihub_models (id),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  system_prompt text check (char_length(system_prompt) <= 20000),
  temperature numeric(3, 2) check (temperature between 0 and 2),
  max_tokens integer check (max_tokens between 1 and 32000),
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aihub_deployments_project_idx on public.aihub_deployments (project_id);
create index if not exists aihub_deployments_owner_idx on public.aihub_deployments (owner_id);

alter table public.aihub_deployments enable row level security;

drop policy if exists "aihub_deployments_owner_select" on public.aihub_deployments;
create policy "aihub_deployments_owner_select" on public.aihub_deployments
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "aihub_deployments_owner_insert" on public.aihub_deployments;
create policy "aihub_deployments_owner_insert" on public.aihub_deployments
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.aihub_projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "aihub_deployments_owner_update" on public.aihub_deployments;
create policy "aihub_deployments_owner_update" on public.aihub_deployments
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "aihub_deployments_owner_delete" on public.aihub_deployments;
create policy "aihub_deployments_owner_delete" on public.aihub_deployments
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Usage rows record which deployment served them and what they cost.
alter table public.aihub_usage_logs
  add column if not exists deployment_id uuid references public.aihub_deployments (id) on delete set null,
  add column if not exists cost_eur numeric(18, 10);
create index if not exists aihub_usage_logs_deployment_time_idx on public.aihub_usage_logs (deployment_id, created_at desc);

-- Spend per project and deployment for a period. security invoker, so RLS limits it
-- to the caller's own rows.
create or replace function public.aihub_billing_summary(p_from timestamptz, p_to timestamptz)
returns table (
  project_id uuid,
  deployment_id uuid,
  model_id text,
  requests bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_eur numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    u.project_id,
    u.deployment_id,
    u.model_id,
    count(*)::bigint,
    coalesce(sum(u.prompt_tokens), 0)::bigint,
    coalesce(sum(u.completion_tokens), 0)::bigint,
    coalesce(sum(u.cost_eur), 0)
  from public.aihub_usage_logs u
  where u.created_at >= p_from and u.created_at < p_to
  group by u.project_id, u.deployment_id, u.model_id;
$$;

revoke all on function public.aihub_billing_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.aihub_billing_summary(timestamptz, timestamptz) to authenticated;
