import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// What a promotion link is worth, so the claim dialog can show the amount before
// redeeming. Answers about one code at a time; the code list itself stays private.
export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !serverEnv.supabaseServiceRoleKey) return Response.json({ valid: false }, { status: 503 });
  const raw = new URL(req.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (raw.length < 3 || raw.length > 40) return Response.json({ valid: false });

  const { data: promo } = await getAdminClient()
    .from("aihub_promotions")
    .select("id, code, credit_eur, is_active, expires_at, max_redemptions, min_account_age_days")
    .eq("code", raw)
    .maybeSingle<{ id: string; code: string; credit_eur: number; is_active: boolean; expires_at: string | null; max_redemptions: number | null; min_account_age_days: number }>();

  if (!promo || !promo.is_active || (promo.expires_at && new Date(promo.expires_at) <= new Date())) {
    return Response.json({ valid: false });
  }
  if (promo.max_redemptions) {
    const { count } = await getAdminClient()
      .from("aihub_promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", promo.id);
    if ((count ?? 0) >= promo.max_redemptions) return Response.json({ valid: false });
  }

  // For a signed-in visitor, say whether they already claimed it and whether their account
  // is old enough. The redeem function enforces the same age rule.
  let alreadyRedeemed = false;
  let eligible = true;
  let eligibleOn: string | null = null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("aihub_promotion_redemptions").select("id").eq("promotion_id", promo.id).maybeSingle();
    alreadyRedeemed = Boolean(data);
    const oldEnoughAt = new Date(new Date(user.created_at).getTime() + promo.min_account_age_days * 86_400_000);
    eligible = oldEnoughAt <= new Date();
    eligibleOn = eligible ? null : oldEnoughAt.toISOString();
  }

  return Response.json({
    valid: true,
    code: promo.code,
    credit_eur: Number(promo.credit_eur),
    min_account_age_days: promo.min_account_age_days,
    already_redeemed: alreadyRedeemed,
    eligible,
    eligible_on: eligibleOn,
  });
}
