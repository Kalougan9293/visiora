-- Chaque écoute complète (≥ ~80 %) incrémente sessions.listens.
-- Le calendrier Suivi reste à 1 jour validé / séance / jour (table listens).
-- À coller dans Supabase → SQL Editor.

create or replace function public.record_listen(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_session_id is null then
    return false;
  end if;

  if not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.user_id = uid
  ) then
    raise exception 'not authorized';
  end if;

  begin
    insert into public.listens (user_id, session_id, listened_on)
    values (uid, p_session_id, (timezone('utc', now()))::date);
  exception
    when unique_violation then
      null;
  end;

  update public.sessions
  set listens = listens + 1, updated_at = now()
  where id = p_session_id and user_id = uid;

  return true;
end;
$$;

revoke all on function public.record_listen(uuid) from public, anon;
grant execute on function public.record_listen(uuid) to authenticated;
