-- Three Gemini-backed models that are not chat models:
--   sunlight-1.1-realtime  Live voice sessions (billed per minute of session window)
--   sunlight-1-tts         Text to speech (billed per token, audio output tokens)
--   sunlight-decision      Closed-set decisions (billed per input token, no output tokens)
--
-- `kind` decides which public endpoint serves the model. Chat models stay on
-- /chat/completions. Deployments of speech and realtime models can carry a default voice.

alter table public.aihub_models
  add column if not exists kind text not null default 'chat'
    check (kind in ('chat', 'realtime', 'tts', 'decision')),
  add column if not exists price_per_minute numeric(10, 4);

alter table public.aihub_deployments
  add column if not exists voice text check (voice is null or char_length(voice) <= 40);

-- Prices in EUR. Reference: Google list prices at launch converted at roughly 0.92 EUR
-- per USD, plus about 25 percent for hosting, keys, limits and billing.
--   sunlight-1-tts        text in 0.60 / 1M, audio out 10.50 / 1M tokens
--   sunlight-decision     input 0.12 / 1M tokens, output tokens are never generated
--   sunlight-1.1-realtime 0.04 per minute (full duplex audio plus extended thinking)
insert into public.aihub_models (
  id, display_name, description, context_window, upstream_model, upstream_base_url,
  is_active, is_legacy, sort_order, input_price_per_mtok, output_price_per_mtok,
  price_per_minute, currency, kind
)
values
  (
    'sunlight-1.1-realtime',
    'Sunlight 1.1 Realtime',
    'Low-latency two-way voice conversations with extended thinking. Connect from the browser or a server over WebSocket.',
    null,
    'gemini-3.8-live-extended-thinking',
    'https://generativelanguage.googleapis.com/v1beta',
    true, false, 4, 0, 0, 0.04, 'EUR', 'realtime'
  ),
  (
    'sunlight-1-tts',
    'Sunlight 1 TTS',
    'Natural text to speech with 30 voices and style direction. Returns WAV or raw PCM audio.',
    null,
    'gemini-3.8-flash-tts',
    'https://generativelanguage.googleapis.com/v1beta',
    true, false, 5, 0.60, 10.50, null, 'EUR', 'tts'
  ),
  (
    'sunlight-decision',
    'Sunlight Decision',
    'Answer up to 1,000 yes/no, multiple-choice and scoring questions about one input in a single call, with calibrated probabilities.',
    262144,
    'gemini-decision-1',
    'https://generativelanguage.googleapis.com/v1beta',
    true, false, 6, 0.12, 0, null, 'EUR', 'decision'
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  upstream_model = excluded.upstream_model,
  upstream_base_url = excluded.upstream_base_url,
  is_active = excluded.is_active,
  is_legacy = excluded.is_legacy,
  sort_order = excluded.sort_order,
  input_price_per_mtok = excluded.input_price_per_mtok,
  output_price_per_mtok = excluded.output_price_per_mtok,
  price_per_minute = excluded.price_per_minute,
  currency = excluded.currency,
  kind = excluded.kind;
