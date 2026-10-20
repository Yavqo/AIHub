# Yavqo AIHub

Console and OpenAI-compatible API for Sunlight models. Users sign in with their Yavqo account,
create projects and API keys, try models in the playground and track usage. Calls are proxied to
the deployed Sunlight gateway (`api.ai.yavqo.com`); the gateway key never leaves the server.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase and gateway values
npm run dev
```

Database: apply `supabase/migrations/20261020_aihub_core.sql` to the shared `yavqo` Supabase
project. It only creates `aihub_*` tables (projects, api_keys, models, usage_logs) with RLS.

## Layout

- `src/app/api/v1/*`: public API (`/models`, `/chat/completions`), bearer `yavqo_live_…` keys
- `src/app/api/playground`: session-authenticated playground proxy
- `src/app/api/keys`, `src/app/api/projects`: console mutations (RLS through the user session)
- `src/lib/gateway.ts`: proxy, SSE passthrough, model rewrite, usage capture
- `src/lib/keys.ts`: key generation and SHA-256 verification (same format as YavqoAPIS)
- UI follows the Yavqo design language; tokens live in `src/app/globals.css`

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
