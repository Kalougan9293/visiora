-- Correction suppression admin : storage + données publiques, puis auth.users.
-- À relancer si « Supprimer » ne fait rien.

create or replace function public.admin_delete_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  if target_id is null then
    return false;
  end if;

  if target_id = auth.uid() then
    raise exception 'cannot delete own account from admin';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = target_id and coalesce(p.is_admin, false)
  ) then
    raise exception 'cannot delete an admin account';
  end if;

  begin
    delete from storage.objects
    where bucket_id = 'audios'
      and name like target_id::text || '/%';
  exception
    when others then
      null;
  end;

  if to_regclass('public.listens') is not null then
    execute 'delete from public.listens where user_id = $1' using target_id;
  end if;

  delete from public.sessions where user_id = target_id;
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;

  return true;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
