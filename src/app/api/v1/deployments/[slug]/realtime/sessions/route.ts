import { handleRealtimeSession } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, ctx: RouteContext<"/api/v1/deployments/[slug]/realtime/sessions">) {
  const { slug } = await ctx.params;
  return handleRealtimeSession(req, slug);
}
