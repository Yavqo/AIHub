import { handleChat } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A deployment's own endpoint. `model` in the body is optional here.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/deployments/[slug]/chat/completions">) {
  const { slug } = await ctx.params;
  return handleChat(req, slug);
}
