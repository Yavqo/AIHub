import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(3).max(40) });

const MESSAGES: Record<string, { status: number; error: string }> = {
  invalid_code: { status: 404, error: "That code isn't valid or has expired." },
  already_redeemed: { status: 409, error: "You've already redeemed this code." },
  fully_redeemed: { status: 410, error: "This code has been fully redeemed." },
  not_eligible: { status: 403, error: "You're not eligible for this promotion. Your account must be at least 30 days old." },
};

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "AIHub is not configured yet." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a promotion code." }, { status: 400 });

  // The database function checks the code, expiry and limits atomically for this user.
  const { data, error } = await supabase.rpc("aihub_redeem_promotion", { p_code: parsed.data.code });
  if (error) {
    const known = MESSAGES[error.message];
    if (known) return Response.json({ error: known.error }, { status: known.status });
    return Response.json({ error: "Could not redeem the code. Try again." }, { status: 500 });
  }
  const row = (data as { code: string; credit_eur: number }[] | null)?.[0];
  return Response.json({ code: row?.code, credit_eur: Number(row?.credit_eur ?? 0) });
}
