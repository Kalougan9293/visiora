-- Visiora CDC — script lisible + listens 1/jour/séance
-- À exécuter dans : Supabase Dashboard → SQL Editor

alter table public.sessions
  add column if not exists script text;

alter table public.sessions
  add column if not exists health_ack_at timestamptz;

create table if not exists public.listens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  listened_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  unique (user_id, session_id, listened_on)
);

create index if not exists listens_user_id_idx on public.listens (user_id);
create index if not exists listens_session_id_idx on public.listens (session_id);
alter table public.listens enable row level security;

drop policy if exists "listens_select_own" on public.listens;
create policy "listens_select_own" on public.listens
  for select using (auth.uid() = user_id);

drop policy if exists "listens_insert_own" on public.listens;
create policy "listens_insert_own" on public.listens
  for insert with check (auth.uid() = user_id);

-- Compteur séance : +1 à chaque écoute complète.
-- Calendrier Suivi : 1 jour validé max / séance / jour (unique listens).
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
