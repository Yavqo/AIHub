import { handleDecision } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/v1/deployments/[slug]/decisions">) {
  const { slug } = await ctx.params;
  return handleDecision(req, slug);
}
