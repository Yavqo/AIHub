import "server-only";
import { after } from "next/server";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import { apiError, notConfigured } from "@/lib/errors";
import { chatBodySchema, forwardChat, type Caller } from "@/lib/gateway";
import {
  createRealtimeSession,
  decisionBodySchema,
  forwardDecision,
  forwardSpeech,
  realtimeSessionSchema,
  speechBodySchema,
} from "@/lib/gemini";
import { isTargetError, resolveTarget, type Target } from "@/lib/deployments";
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

async function handleModelCall<T extends { model?: string }>(
  req: Request,
  schema: z.ZodType<T>,
  forward: (body: T, target: Target, caller: Caller) => Promise<Response>,
  slug?: string,
  allowEmptyBody = false,
): Promise<Response> {
  const key = await authenticate(req);
  if (key instanceof Response) return key;

  let json: unknown;
  try {
    const raw = await req.text();
    json = !raw.trim() && allowEmptyBody ? {} : JSON.parse(raw);
  } catch {
    return apiError(400, "Request body must be valid JSON.", "invalid_request_error");
  }
  const parsed = schema.safeParse(json);
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
  return forward(parsed.data, target, {
    owner_id: key.owner_id,
    project_id: key.project_id,
    api_key_id: key.id,
    source: "api",
  });
}

// Chat for an API key. `slug` comes from a deployment URL; otherwise the body's model names
// a base model or one of the project's deployments.
export async function handleChat(req: Request, slug?: string): Promise<Response> {
  return handleModelCall(req, chatBodySchema, forwardChat, slug);
}

// Text-to-speech (`sunlight-1-tts` or a deployment of it).
export async function handleSpeech(req: Request, slug?: string): Promise<Response> {
  return handleModelCall(req, speechBodySchema, forwardSpeech, slug);
}

// Closed-set structured decisions (`sunlight-decision` or a deployment of it).
export async function handleDecision(req: Request, slug?: string): Promise<Response> {
  return handleModelCall(req, decisionBodySchema, forwardDecision, slug);
}

// Ephemeral realtime WebSocket session (`sunlight-1.1-realtime` or a deployment of it).
export async function handleRealtimeSession(req: Request, slug?: string): Promise<Response> {
  return handleModelCall(req, realtimeSessionSchema, createRealtimeSession, slug, true);
}
