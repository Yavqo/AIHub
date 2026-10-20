import { isSupabaseConfigured, serverEnv } from "@/lib/env";
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

  const { data } = await supabase.from("aihub_deployments").select("id, status").eq("id", id).maybeSingle();
  if (!data) return Response.json({ error: "Deployment not found" }, { status: 404 });

  const started = Date.now();
  try {
    const res = await fetch(`${serverEnv.gatewayBaseUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return Response.json({ ok: res.ok, latency_ms: Date.now() - started, status: data.status });
  } catch {
    return Response.json({ ok: false, latency_ms: Date.now() - started, status: data.status });
  }
}
