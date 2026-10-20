import { isTargetError, resolveTarget } from "@/lib/deployments";
import { isSupabaseConfigured } from "@/lib/env";
import { apiError } from "@/lib/errors";
import { chatBodySchema, forwardChat } from "@/lib/gateway";
import { isRateLimited } from "@/lib/ratelimit";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Signed-in playground. Uses the session, so the browser never sees a key. Calls to a
// deployment are billed to that deployment's project.
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: { message: "AIHub is not configured yet." } }, { status: 503 });
  const user = await getUser();
  if (!user) return apiError(401, "Sign in to use the playground.", "authentication_error");

  const parsed = chatBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.model) return apiError(400, "Invalid request.", "invalid_request_error");

  const target = await resolveTarget(parsed.data.model, { ownerId: user.id });
  if (isTargetError(target)) return apiError(target.status, target.message, "invalid_request_error", target.code);

  // Deployments apply their own limits in forwardChat; base-model chats use the account cap.
  if (!target.deployment && (await isRateLimited("owner_id", user.id))) {
    return apiError(429, "You're sending messages too quickly. Try again in a minute.", "rate_limit_error", "rate_limit_exceeded", { "Retry-After": "60" });
  }

  return forwardChat({ ...parsed.data, stream: true }, target, {
    owner_id: user.id,
    project_id: target.deployment?.project_id ?? null,
    api_key_id: null,
    source: "playground",
  });
}
