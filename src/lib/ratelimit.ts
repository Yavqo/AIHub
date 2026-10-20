import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

// v1: count this key's requests in the last 60 seconds from the usage log. Works across
// serverless instances without extra infrastructure; swap for Redis if volume grows.
export async function isRateLimited(column: "api_key_id" | "owner_id", id: string): Promise<boolean> {
  const limit = serverEnv.rateLimitPerMin;
  if (!limit || limit <= 0) return false;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await getAdminClient()
    .from("aihub_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq(column, id)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= limit;
}

export type DeploymentSlot = {
  allowed: boolean;
  window: string;
  headers: Record<string, string>;
  reason?: "requests" | "tokens";
  retryAfter: number;
};

// Per-deployment limits: takes a request slot in the current minute, atomically in the
// database, so the count holds across all server instances. Headers follow the OpenAI
// x-ratelimit-* names.
export async function takeDeploymentSlot(d: { id: string; rpm_limit: number; tpm_limit: number }): Promise<DeploymentSlot | null> {
  const { data, error } = await getAdminClient().rpc("aihub_rate_take" as never, {
    p_deployment: d.id,
    p_rpm: d.rpm_limit,
    p_tpm: d.tpm_limit,
  } as never);
  const row = (data as { allowed: boolean; requests: number; tokens: number; window_start: string; reset_at: string }[] | null)?.[0];
  if (error || !row) {
    // Fail open: a counter outage should not take every deployment down.
    console.error("aihub rate limit check failed", error?.message);
    return null;
  }
  const retryAfter = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
  const tokens = Number(row.tokens);
  return {
    allowed: row.allowed,
    window: row.window_start,
    reason: row.allowed ? undefined : row.requests >= d.rpm_limit ? "requests" : "tokens",
    retryAfter,
    headers: {
      "x-ratelimit-limit-requests": String(d.rpm_limit),
      "x-ratelimit-remaining-requests": String(Math.max(d.rpm_limit - row.requests, 0)),
      "x-ratelimit-reset-requests": `${retryAfter}s`,
      "x-ratelimit-limit-tokens": String(d.tpm_limit),
      "x-ratelimit-remaining-tokens": String(Math.max(d.tpm_limit - tokens, 0)),
      "x-ratelimit-reset-tokens": `${retryAfter}s`,
    },
  };
}

export async function addDeploymentTokens(deploymentId: string, window: string, tokens: number) {
  if (!tokens) return;
  const { error } = await getAdminClient().rpc("aihub_rate_add_tokens" as never, {
    p_deployment: deploymentId,
    p_window: window,
    p_tokens: Math.round(tokens),
  } as never);
  if (error) console.error("aihub rate token update failed", error.message);
}
