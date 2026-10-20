import { authenticate } from "@/lib/api";
import { isTargetError, resolveTarget } from "@/lib/deployments";
import { apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Lets OpenAI SDKs pointed at a deployment's base URL list it as their one model.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/deployments/[slug]/models">) {
  const key = await authenticate(req);
  if (key instanceof Response) return key;
  const { slug } = await ctx.params;
  const target = await resolveTarget(slug, { projectId: key.project_id });
  if (isTargetError(target)) return apiError(target.status, target.message, "invalid_request_error", target.code);
  if (!target.deployment) {
    return apiError(404, `No deployment called '${slug}' in this project.`, "invalid_request_error", "model_not_found");
  }
  return Response.json({
    object: "list",
    data: [{ id: target.deployment.slug, object: "model", created: 0, owned_by: "yavqo", name: target.deployment.name, base_model: target.model.id }],
  });
}
