import { z } from "zod";
import { listModels } from "@/lib/catalog";
import { deploymentFields, makeSlug } from "@/lib/deployments";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  project_id: z.string().uuid(),
  base_model_id: z.string().min(1).max(100),
  ...deploymentFields,
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the deployment name and settings." }, { status: 400 });

  const model = (await listModels()).find((m) => m.id === parsed.data.base_model_id && m.is_active);
  if (!model) return Response.json({ error: "That model can't be deployed right now." }, { status: 400 });

  // RLS checks that the project belongs to the caller.
  const { data, error } = await supabase
    .from("aihub_deployments")
    .insert({
      ...parsed.data,
      system_prompt: parsed.data.system_prompt?.trim() || null,
      owner_id: user.id,
      slug: makeSlug(parsed.data.name),
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.code === "42501" ? "Project not found." : error.message }, { status: error.code === "42501" ? 404 : 500 });
  return Response.json({ deployment: data }, { status: 201 });
}
