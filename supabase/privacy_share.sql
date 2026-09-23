-- Autorisation de lecture des séances + liste admin réservée aux comptes qui l'ont donnée.
-- À exécuter dans : Supabase Dashboard → SQL Editor

alter table public.profiles
  add column if not exists share_sessions boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, first_name, last_name, email, cgu_accepted, cgu_accepted_at, share_sessions
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.email, ''),
    coalesce((new.raw_user_meta_data->>'cgu_accepted')::boolean, false),
    case
      when coalesce((new.raw_user_meta_data->>'cgu_accepted')::boolean, false) then now()
      else null
    end,
    coalesce((new.raw_user_meta_data->>'share_sessions')::boolean, false)
  );
  return new;
end;
$$;

create or replace function public.admin_list_shared_sessions()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  session_id uuid,
  title text,
  answers jsonb,
  script text,
  listens int,
  created_at timestamptz
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
    s.id,
    s.title,
    s.answers,
    s.script,
    s.listens,
    s.created_at
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where p.share_sessions = true
    and coalesce(p.is_admin, false) = false
  order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_shared_sessions() from public, anon;
grant execute on function public.admin_list_shared_sessions() to authenticated;
