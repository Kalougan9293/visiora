-- Admin dashboard RPCs (bypass RLS — à durcir plus tard)
-- Exécuter après schema.sql dans le SQL Editor

create or replace function public.admin_list_users()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  audio_count bigint,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    (
      select count(*)::bigint
      from public.sessions s
      where s.user_id = p.id
    ) as audio_count,
    p.last_seen_at
  from public.profiles p
  order by p.created_at desc;
$$;

create or replace function public.admin_dashboard_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'users', (select count(*)::bigint from public.profiles),
    'audios', (select count(*)::bigint from public.sessions),
    'storage_bytes', coalesce((select sum(audio_bytes)::bigint from public.sessions), 0)
  );
$$;

grant execute on function public.admin_list_users() to anon, authenticated;
grant execute on function public.admin_dashboard_stats() to anon, authenticated;

-- Supprime profil + séances (cascade) + fichiers Storage + compte Auth
create or replace function public.admin_delete_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_id is null then
    return false;
  end if;

  delete from storage.objects
  where bucket_id = 'audios'
    and (storage.foldername(name))[1] = target_id::text;

  -- Cascade : profiles → sessions ; auth.users → profiles
  delete from auth.users where id = target_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to anon, authenticated;
