-- Anti-abuse: a promotion can require a minimum account age (default 30 days), so new
-- throwaway accounts can't collect credits.

alter table public.aihub_promotions
  add column if not exists min_account_age_days integer not null default 30 check (min_account_age_days >= 0);

create or replace function public.aihub_redeem_promotion(p_code text)
returns table (code text, credit_eur numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_user_created timestamptz;
  v_promo public.aihub_promotions%rowtype;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_promo
  from public.aihub_promotions p
  where p.code = upper(btrim(p_code))
  for update;

  if not found or not v_promo.is_active or (v_promo.expires_at is not null and v_promo.expires_at <= now()) then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  select u.created_at into v_user_created from auth.users u where u.id = v_user;
  if v_user_created is null or v_user_created > now() - make_interval(days => v_promo.min_account_age_days) then
    raise exception 'not_eligible' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.aihub_promotion_redemptions r
    where r.promotion_id = v_promo.id and r.owner_id = v_user
  ) then
    raise exception 'already_redeemed' using errcode = 'P0001';
  end if;

  if v_promo.max_redemptions is not null then
    select count(*) into v_count from public.aihub_promotion_redemptions r where r.promotion_id = v_promo.id;
    if v_count >= v_promo.max_redemptions then
      raise exception 'fully_redeemed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.aihub_promotion_redemptions (promotion_id, owner_id, code, credit_eur)
  values (v_promo.id, v_user, v_promo.code, v_promo.credit_eur);

  return query select v_promo.code, v_promo.credit_eur;
end;
$$;

revoke all on function public.aihub_redeem_promotion(text) from public, anon;
grant execute on function public.aihub_redeem_promotion(text) to authenticated;
