import { z } from "zod";
import { deploymentFields } from "@/lib/deployments";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    name: deploymentFields.name.optional(),
    system_prompt: deploymentFields.system_prompt,
    temperature: deploymentFields.temperature,
    max_tokens: deploymentFields.max_tokens,
    rpm_limit: deploymentFields.rpm_limit,
    tpm_limit: deploymentFields.tpm_limit,
    status: z.enum(["active", "paused"]).optional(),
  })
  .strict();

const SUSPENDED = "This deployment is suspended by Yavqo, so it can't be changed or deleted. Contact Yavqo support.";

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/deployments/[id]">) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const { id } = await ctx.params;
  const { supabase, user } = await session();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the deployment settings." }, { status: 400 });
  const patch = { ...parsed.data, updated_at: new Date().toISOString() };
  if (typeof patch.system_prompt === "string") patch.system_prompt = patch.system_prompt.trim() || null;
  const { data, error } = await supabase.from("aihub_deployments").update(patch).eq("id", id).select().maybeSingle();
  if (error?.message === "deployment_suspended") return Response.json({ error: SUSPENDED }, { status: 403 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Deployment not found" }, { status: 404 });
  return Response.json({ deployment: data });
}

// Deleting keeps usage history; those rows lose their deployment link.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/deployments/[id]">) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const { id } = await ctx.params;
  const { supabase, user } = await session();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data, error } = await supabase.from("aihub_deployments").delete().eq("id", id).select("id").maybeSingle();
  if (error?.message === "deployment_suspended") return Response.json({ error: SUSPENDED }, { status: 403 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Deployment not found" }, { status: 404 });
  return Response.json({ ok: true });
}
