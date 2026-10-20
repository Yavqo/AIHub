import { authenticate } from "@/lib/api";
import { listModels } from "@/lib/catalog";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Deployment } from "@/lib/types";

export const dynamic = "force-dynamic";

// Base models plus the active deployments of the key's project.
export async function GET(req: Request) {
  const key = await authenticate(req);
  if (key instanceof Response) return key;
  const [models, { data: deployments }] = await Promise.all([
    listModels(),
    getAdminClient().from("aihub_deployments").select("*").eq("project_id", key.project_id).eq("status", "active"),
  ]);
  return Response.json({
    object: "list",
    data: [
      ...models.filter((m) => m.is_active).map((m) => ({ id: m.id, object: "model", created: 0, owned_by: "yavqo", name: m.display_name })),
      ...((deployments ?? []) as Deployment[]).map((d) => ({ id: d.slug, object: "model", created: 0, owned_by: "yavqo", name: d.name, base_model: d.base_model_id })),
    ],
  });
}
