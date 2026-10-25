-- Mots-clés écran détresse : arrêt net (3114), éditables sans redéploiement.
-- Dashboard → SQL Editor, puis recharger /admin.

create table if not exists public.distress_keywords (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  created_at timestamptz not null default now()
);

alter table public.distress_keywords enable row level security;

drop policy if exists distress_keywords_select on public.distress_keywords;
create policy distress_keywords_select
  on public.distress_keywords
  for select
  to authenticated
  using (true);

drop policy if exists distress_keywords_insert on public.distress_keywords;
create policy distress_keywords_insert
  on public.distress_keywords
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists distress_keywords_delete on public.distress_keywords;
create policy distress_keywords_delete
  on public.distress_keywords
  for delete
  to authenticated
  using (public.is_current_user_admin());

insert into public.distress_keywords (word) values
  ('suicide'),
  ('suicider'),
  ('suicidaire'),
  ('me suicider'),
  ('en finir'),
  ('me faire du mal'),
  ('me tuer'),
  ('mourir'),
  ('envie de mourir'),
  ('finir mes jours'),
  ('mettre fin a mes jours'),
  ('plus envie de vivre'),
  ('me foutre en l''air'),
  ('ne plus etre la'),
  ('me supprimer')
on conflict (word) do nothing;
