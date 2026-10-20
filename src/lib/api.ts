import "server-only";
import { after } from "next/server";
import { serverEnv } from "@/lib/env";
import { apiError, notConfigured } from "@/lib/errors";
import { chatBodySchema, forwardChat } from "@/lib/gateway";
import { isTargetError, resolveTarget } from "@/lib/deployments";
import { readBearer, touchKey, verifyKey, type VerifiedKey } from "@/lib/keys";
import { isRateLimited } from "@/lib/ratelimit";

// Shared by every public /api/v1 route: config check, key check, rate limit.
export async function authenticate(req: Request, opts: { rateLimit?: boolean } = {}): Promise<VerifiedKey | Response> {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) return notConfigured();
  const raw = readBearer(req);
  if (!raw) return apiError(401, "Missing or malformed API key. Send 'Authorization: Bearer yavqo_live_…'.", "authentication_error", "invalid_api_key");
  const key = await verifyKey(raw);
  if (!key) return apiError(401, "This API key is invalid or has been revoked.", "authentication_error", "invalid_api_key");
  if (opts.rateLimit && (await isRateLimited("api_key_id", key.id))) {
    return apiError(429, "Rate limit reached for this key. Try again in a minute.", "rate_limit_error", "rate_limit_exceeded", { "Retry-After": "60" });
  }
  return key;
}

// Chat for an API key. `slug` comes from a deployment URL; otherwise the body's model names
// a base model or one of the project's deployments.
export async function handleChat(req: Request, slug?: string): Promise<Response> {
  const key = await authenticate(req);
  if (key instanceof Response) return key;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, "Request body must be valid JSON.", "invalid_request_error");
  }
  const parsed = chatBodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(400, `Invalid request: ${issue.path.join(".") || "body"} ${issue.message}`, "invalid_request_error");
  }

  const name = slug ?? parsed.data.model;
  if (!name) return apiError(400, "Invalid request: model is required.", "invalid_request_error");

  const target = await resolveTarget(name, { projectId: key.project_id });
  if (isTargetError(target)) return apiError(target.status, target.message, "invalid_request_error", target.code);

  // Deployments enforce their own per-minute limits; the key-wide cap covers base-model calls.
  if (!target.deployment && (await isRateLimited("api_key_id", key.id))) {
    return apiError(429, "Rate limit reached for this key. Try again in a minute.", "rate_limit_error", "rate_limit_exceeded", { "Retry-After": "60" });
  }

  after(() => touchKey(key.id));
  return forwardChat(parsed.data, target, {
    owner_id: key.owner_id,
    project_id: key.project_id,
    api_key_id: key.id,
    source: "api",
  });
}
