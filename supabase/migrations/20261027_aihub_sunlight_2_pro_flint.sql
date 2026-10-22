-- Sunlight 2 Pro now runs on recursive/flint-v1.0:free. The gateway forwards model
-- names it doesn't alias, so AIHub sends the upstream name directly.
update public.aihub_models
set upstream_model = 'recursive/flint-v1.0:free'
where id = 'sunlight-2-pro';
