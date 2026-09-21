-- Visiora — Phase 1 : durcir admin + colonne is_admin
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- (projet déjà provisionné avec schema.sql + admin.sql)

-- 1) Colonne admin (défaut false — promouvoir à la main, voir fin du fichier)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Empêche un user connecté de s’auto-promouvoir via l’API
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_admin is distinct from old.is_admin
     and auth.uid() is not null then
    raise exception 'is_admin ne peut pas être modifié côté client';
  end if;
  if tg_op = 'INSERT'
     and new.is_admin = true
     and auth.uid() is not null then
    raise exception 'is_admin ne peut pas être défini à l''inscription';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_admin on public.profiles;
create trigger profiles_protect_is_admin
  before insert or update on public.profiles
  for each row execute function public.protect_is_admin();

-- 2) Helper : l’appelant est-il admin ?
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

-- 3) RPCs admin — réservées aux profils is_admin = true
create or replace function public.admin_list_users()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  audio_count bigint,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  return query
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
  where coalesce(p.is_admin, false) = false
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  return json_build_object(
    'users', (select count(*)::bigint from public.profiles where coalesce(is_admin, false) = false),
    'audios', (select count(*)::bigint from public.sessions),
    'storage_bytes', coalesce((select sum(audio_bytes)::bigint from public.sessions), 0)
  );
end;
$$;

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

  delete from storage.objects
  where bucket_id = 'audios'
    and (storage.foldername(name))[1] = target_id::text;

  delete from auth.users where id = target_id;

  return true;
end;
$$;

-- 4) Plus d’accès anon / public aux RPCs admin
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_dashboard_stats() from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;

grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 5) Promouvoir ton compte admin (remplace l’email) :
-- update public.profiles set is_admin = true where email = 'ton@email.com';
