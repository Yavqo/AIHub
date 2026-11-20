-- Add legacy status and per-model upstream base URL support to aihub_models.
-- Marks sunlight-2-pro as legacy (existing deployments keep working; new deployments
-- are blocked) and enables sunlight-2.1 and sunlight-2.1-pro as deployable models.

alter table public.aihub_models
  add column if not exists is_legacy boolean not null default false,
  add column if not exists upstream_base_url text;

insert into public.aihub_models (
  id,
  display_name,
  description,
  context_window,
  upstream_model,
  upstream_base_url,
  is_active,
  is_legacy,
  sort_order,
  input_price_per_mtok,
  output_price_per_mtok,
  currency
)
values
  (
    'sunlight-2.1-pro',
    'Sunlight 2.1 Pro',
    'Deeper reasoning for code, research and long answers.',
    null,
    'claude-opus-5-5',
    'https://freemodel.in/v1',
    true,
    false,
    1,
    2.50,
    10.00,
    'EUR'
  ),
  (
    'sunlight-2.1',
    'Sunlight 2.1',
    'Fast everyday model for chat and short tasks.',
    null,
    'deepseek/deepseek-v4.1-flash-free',
    'https://api.orcarouter.ai/v1',
    true,
    false,
    2,
    0.50,
    2.00,
    'EUR'
  ),
  (
    'sunlight-2-pro',
    'Sunlight 2 Pro',
    'Previous-generation model kept online for existing deployments.',
    null,
    'recursive/flint-v1.0:free',
    null,
    true,
    true,
    3,
    2.50,
    10.00,
    'EUR'
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  upstream_model = excluded.upstream_model,
  upstream_base_url = excluded.upstream_base_url,
  is_active = excluded.is_active,
  is_legacy = excluded.is_legacy,
  sort_order = excluded.sort_order,
  input_price_per_mtok = excluded.input_price_per_mtok,
  output_price_per_mtok = excluded.output_price_per_mtok,
  currency = excluded.currency;
