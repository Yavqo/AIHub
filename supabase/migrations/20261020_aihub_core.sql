-- Yavqo AIHub core schema. All tables are prefixed aihub_ and live alongside the
-- existing Yavqo tables in the shared Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.aihub_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists aihub_projects_owner_idx on public.aihub_projects (owner_id);

create table if not exists public.aihub_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.aihub_projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null,
  last4 text not null,
  key_hash text not null unique,
  scopes text[] not null default array['inference'],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aihub_api_keys_owner_idx on public.aihub_api_keys (owner_id);
create index if not exists aihub_api_keys_project_idx on public.aihub_api_keys (project_id);

create table if not exists public.aihub_models (
  id text primary key,
  display_name text not null,
  description text not null,
  context_window integer,
  upstream_model text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.aihub_usage_logs (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.aihub_api_keys (id) on delete set null,
  project_id uuid references public.aihub_projects (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  model_id text,
  source text not null default 'api' check (source in ('api', 'playground')),
  endpoint text not null,
  status_code integer not null,
  stream boolean not null default false,
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists aihub_usage_logs_project_time_idx on public.aihub_usage_logs (project_id, created_at desc);
create index if not exists aihub_usage_logs_owner_time_idx on public.aihub_usage_logs (owner_id, created_at desc);
create index if not exists aihub_usage_logs_key_time_idx on public.aihub_usage_logs (api_key_id, created_at desc);

-- Row level security: owners see and manage only their own rows. The service role
-- (server-only) bypasses RLS for key verification and usage writes.
alter table public.aihub_projects enable row level security;
alter table public.aihub_api_keys enable row level security;
alter table public.aihub_models enable row level security;
alter table public.aihub_usage_logs enable row level security;

drop policy if exists "aihub_projects_owner_all" on public.aihub_projects;
create policy "aihub_projects_owner_all" on public.aihub_projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "aihub_api_keys_owner_select" on public.aihub_api_keys;
create policy "aihub_api_keys_owner_select" on public.aihub_api_keys
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "aihub_api_keys_owner_insert" on public.aihub_api_keys;
create policy "aihub_api_keys_owner_insert" on public.aihub_api_keys
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.aihub_projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "aihub_api_keys_owner_update" on public.aihub_api_keys;
create policy "aihub_api_keys_owner_update" on public.aihub_api_keys
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "aihub_models_read" on public.aihub_models;
create policy "aihub_models_read" on public.aihub_models
  for select to anon, authenticated
  using (true);

drop policy if exists "aihub_usage_logs_owner_select" on public.aihub_usage_logs;
create policy "aihub_usage_logs_owner_select" on public.aihub_usage_logs
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Catalog. The deployed gateway serves Sunlight 2.1 Pro today.
insert into public.aihub_models (id, display_name, description, context_window, upstream_model, is_active, sort_order)
values
  ('sunlight-2.1-pro', 'Sunlight 2.1 Pro', 'Deeper reasoning for code, research and long answers.', null, 'sunlight-2.1-pro', true, 1),
  ('sunlight-2.1', 'Sunlight 2.1', 'Fast everyday model for chat and short tasks.', null, 'sunlight-2.1', false, 2)
on conflict (id) do nothing;
