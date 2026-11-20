import { listModels } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveUpstream } from "@/lib/gateway";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Live check used by the deploy screen: the deployment exists for this user and the
// model gateway answers. Returns only ok and timing, never gateway details.
export async function GET(_req: Request, ctx: RouteContext<"/api/deployments/[id]/health">) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data } = await supabase.from("aihub_deployments").select("id, status, base_model_id").eq("id", id).maybeSingle();
  if (!data) return Response.json({ error: "Deployment not found" }, { status: 404 });

  const model = (await listModels()).find((m) => m.id === data.base_model_id);
  const upstream = resolveUpstream({ upstream_base_url: model?.upstream_base_url ?? null });
  const checkUrl = upstream.isCustom ? `${upstream.baseUrl}/models` : `${upstream.baseUrl}/health`;

  const started = Date.now();
  try {
    const res = await fetch(checkUrl, {
      cache: "no-store",
      headers: upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : undefined,
      signal: AbortSignal.timeout(8000),
    });
    return Response.json({ ok: res.ok, latency_ms: Date.now() - started, status: data.status });
  } catch {
    return Response.json({ ok: false, latency_ms: Date.now() - started, status: data.status });
  }
}
