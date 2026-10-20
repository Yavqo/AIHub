-- The gateway now serves Sunlight 2 Pro (alias sunlight-2-pro). Replace the 2.1 catalog.
insert into public.aihub_models (id, display_name, description, context_window, upstream_model, is_active, sort_order)
values ('sunlight-2-pro', 'Sunlight 2 Pro', 'Fast, capable model for code, research and everyday chat.', null, 'sunlight-2-pro', true, 1)
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  upstream_model = excluded.upstream_model,
  is_active = true,
  sort_order = excluded.sort_order;

delete from public.aihub_models where id in ('sunlight-2.1-pro', 'sunlight-2.1');
