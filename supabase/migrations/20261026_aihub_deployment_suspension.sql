-- Suspension: Yavqo can suspend a deployment. Suspended deployments refuse all calls,
-- and their owners can't resume, edit or delete them. Only admins (service role or a
-- database session such as the SQL editor) can suspend or lift a suspension.
--
-- Suspend:  update public.aihub_deployments
--           set status = 'suspended', suspended_reason = 'Violates the usage policy', suspended_at = now()
--           where slug = '<slug>';
-- Lift:     update public.aihub_deployments
--           set status = 'active', suspended_reason = null, suspended_at = null
--           where slug = '<slug>';

alter table public.aihub_deployments drop constraint if exists aihub_deployments_status_check;
alter table public.aihub_deployments
  add constraint aihub_deployments_status_check check (status in ('active', 'paused', 'suspended'));

alter table public.aihub_deployments
  add column if not exists suspended_reason text check (char_length(suspended_reason) <= 500),
  add column if not exists suspended_at timestamptz;

create or replace function public.aihub_deployments_guard_suspension()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Admin sessions (service role, SQL editor) may do anything.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'suspended' then
      raise exception 'deployment_suspended' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'suspended' then
    raise exception 'deployment_suspended' using errcode = 'P0001';
  end if;

  if new.status = 'suspended'
     or new.suspended_reason is not null
     or new.suspended_at is not null then
    raise exception 'deployment_suspended' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists aihub_deployments_guard_suspension on public.aihub_deployments;
create trigger aihub_deployments_guard_suspension
  before insert or update or delete on public.aihub_deployments
  for each row execute function public.aihub_deployments_guard_suspension();
