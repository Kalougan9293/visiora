-- Mesures d'usage, sans contenu de séance.
-- À exécuter dans : Supabase Dashboard → SQL Editor

create table if not exists public.listen_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_seconds numeric not null default 0,
  stop_seconds numeric not null default 0,
  max_seconds numeric not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists listen_plays_user_idx on public.listen_plays (user_id, started_at);
create index if not exists listen_plays_session_idx on public.listen_plays (session_id, started_at);

create table if not exists public.wizard_drops (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  step_number int not null,
  question_ids text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists wizard_drops_user_idx on public.wizard_drops (user_id, updated_at);

create table if not exists public.listen_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  scale int not null check (scale between 1 and 10),
  remark text,
  created_at timestamptz not null default now()
);

create index if not exists listen_feedback_user_idx on public.listen_feedback (user_id, created_at);

alter table public.listen_plays enable row level security;
alter table public.wizard_drops enable row level security;
alter table public.listen_feedback enable row level security;

drop policy if exists "listen_plays_own" on public.listen_plays;
create policy "listen_plays_own" on public.listen_plays
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wizard_drops_own" on public.wizard_drops;
create policy "wizard_drops_own" on public.wizard_drops
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "listen_feedback_insert_own" on public.listen_feedback;
create policy "listen_feedback_insert_own" on public.listen_feedback
  for insert with check (auth.uid() = user_id);

create or replace function public.admin_export_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'plays', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (
        select
          p.user_id,
          p.session_id,
          p.started_at,
          p.duration_seconds,
          p.stop_seconds,
          p.max_seconds,
          p.completed,
          row_number() over (
            partition by p.user_id, p.session_id
            order by p.started_at
          ) as listen_index,
          round((
            extract(epoch from (
              p.started_at - min(p.started_at) over (
                partition by p.user_id, p.session_id
              )
            )) / 86400.0
          )::numeric, 1) as days_since_first
        from public.listen_plays p
        order by p.started_at
      ) t
    ), '[]'::jsonb),
    'drops', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (
        select user_id, step_number, question_ids, completed, updated_at
        from public.wizard_drops
        order by updated_at
      ) t
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (
        select user_id, session_id, scale, remark, created_at
        from public.listen_feedback
        order by created_at
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_export_metrics() from public, anon;
grant execute on function public.admin_export_metrics() to authenticated;
