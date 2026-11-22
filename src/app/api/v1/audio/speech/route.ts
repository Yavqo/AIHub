import { handleSpeech } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleSpeech(req);
}
