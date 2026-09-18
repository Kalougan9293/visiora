-- Visiora — schéma initial Supabase
-- À exécuter dans : Supabase Dashboard → SQL Editor

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  cgu_accepted boolean not null default false,
  cgu_accepted_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

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

create index if not exists profiles_email_idx on public.profiles (email);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Séance personnalisée',
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed')),
  duration_minutes int not null default 15,
  listens int not null default 0,
  audio_path text,
  audio_url text,
  audio_bytes bigint,
  voice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own" on public.sessions for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sessions_delete_own" on public.sessions;
create policy "sessions_delete_own" on public.sessions for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, email, cgu_accepted, cgu_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.email, ''),
    coalesce((new.raw_user_meta_data->>'cgu_accepted')::boolean, false),
    case when coalesce((new.raw_user_meta_data->>'cgu_accepted')::boolean, false) then now() else null end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 52428800, array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a'])
on conflict (id) do nothing;

drop policy if exists "audios_select_own" on storage.objects;
create policy "audios_select_own" on storage.objects for select
  using (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "audios_insert_own" on storage.objects;
create policy "audios_insert_own" on storage.objects for insert
  with check (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "audios_update_own" on storage.objects;
create policy "audios_update_own" on storage.objects for update
  using (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "audios_delete_own" on storage.objects;
create policy "audios_delete_own" on storage.objects for delete
  using (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1]);
