-- Droit à l'effacement : le compte connecté supprime ses données, puis lui-même.
-- À exécuter dans Supabase → SQL Editor.
-- Un compte admin est refusé.

create or replace function public.delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authorized';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = uid and coalesce(p.is_admin, false)
  ) then
    raise exception 'cannot delete an admin account';
  end if;

  begin
    delete from storage.objects
    where bucket_id = 'audios'
      and name like uid::text || '/%';
  exception
    when others then
      null;
  end;

  if to_regclass('public.listen_feedback') is not null then
    execute 'delete from public.listen_feedback where user_id = $1' using uid;
  end if;
  if to_regclass('public.listen_plays') is not null then
    execute 'delete from public.listen_plays where user_id = $1' using uid;
  end if;
  if to_regclass('public.wizard_drops') is not null then
    execute 'delete from public.wizard_drops where user_id = $1' using uid;
  end if;
  if to_regclass('public.listens') is not null then
    execute 'delete from public.listens where user_id = $1' using uid;
  end if;

  delete from public.sessions where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;

  return true;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
