import { handleRealtimeSession } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  return handleRealtimeSession(req);
}
