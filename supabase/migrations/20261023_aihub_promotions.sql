-- Promotion codes that grant free AI credits (EUR) against token charges.

create table if not exists public.aihub_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 40),
  credit_eur numeric(10, 2) not null check (credit_eur > 0),
  max_redemptions integer check (max_redemptions > 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.aihub_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.aihub_promotions (id) on delete restrict,
  owner_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  credit_eur numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  unique (promotion_id, owner_id)
);
create index if not exists aihub_promotion_redemptions_owner_idx on public.aihub_promotion_redemptions (owner_id, created_at);

-- Codes are never readable by clients, so they can't be listed or guessed from the API.
alter table public.aihub_promotions enable row level security;
alter table public.aihub_promotion_redemptions enable row level security;

drop policy if exists "aihub_promotion_redemptions_owner_select" on public.aihub_promotion_redemptions;
create policy "aihub_promotion_redemptions_owner_select" on public.aihub_promotion_redemptions
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Redeem a code for the signed-in user. Runs as definer so it can read the code table;
-- it only ever acts for auth.uid(). Locks the promotion row so max_redemptions holds.
create or replace function public.aihub_redeem_promotion(p_code text)
returns table (code text, credit_eur numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
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

-- Credits for the signed-in user. Credits cover charges made after the first redemption,
-- oldest first. covered_in_period is how much of the period's charges credits paid for.
create or replace function public.aihub_credit_summary(p_from timestamptz, p_to timestamptz)
returns table (
  credits_total numeric,
  credits_used numeric,
  credits_remaining numeric,
  covered_in_period numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  credits as (
    select coalesce(sum(r.credit_eur), 0) as total, min(r.created_at) as since
    from public.aihub_promotion_redemptions r, me
    where r.owner_id = me.uid
  ),
  spend as (
    select
      coalesce(sum(u.cost_eur) filter (where u.created_at < p_from), 0) as before_period,
      coalesce(sum(u.cost_eur) filter (where u.created_at >= p_from and u.created_at < p_to), 0) as in_period,
      coalesce(sum(u.cost_eur), 0) as all_time
    from public.aihub_usage_logs u, me, credits c
    where u.owner_id = me.uid and c.since is not null and u.created_at >= c.since
  )
  select
    c.total,
    least(c.total, s.all_time),
    c.total - least(c.total, s.all_time),
    least(s.in_period, greatest(c.total - s.before_period, 0))
  from credits c, spend s;
$$;

revoke all on function public.aihub_credit_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.aihub_credit_summary(timestamptz, timestamptz) to authenticated;

insert into public.aihub_promotions (code, credit_eur)
values ('SUNLIGHT15', 15.00)
on conflict (code) do nothing;
