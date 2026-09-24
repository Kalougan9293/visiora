-- Mots-clés écran santé : éditables sans redéploiement.
-- Dashboard → SQL Editor, puis recharger /admin.

create table if not exists public.health_keywords (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  created_at timestamptz not null default now()
);

alter table public.health_keywords enable row level security;

drop policy if exists health_keywords_select on public.health_keywords;
create policy health_keywords_select
  on public.health_keywords
  for select
  to authenticated
  using (true);

drop policy if exists health_keywords_insert on public.health_keywords;
create policy health_keywords_insert
  on public.health_keywords
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists health_keywords_delete on public.health_keywords;
create policy health_keywords_delete
  on public.health_keywords
  for delete
  to authenticated
  using (public.is_current_user_admin());

insert into public.health_keywords (word) values
  ('maladie'),
  ('malade'),
  ('guerir'),
  ('guerison'),
  ('remission'),
  ('diagnostic'),
  ('traitement'),
  ('cancer'),
  ('depression'),
  ('anxiete'),
  ('angoisse'),
  ('burn-out'),
  ('pathologie'),
  ('therapie'),
  ('medicament'),
  ('diabete'),
  ('hypertension'),
  ('asthme'),
  ('fibromyalgie'),
  ('endometriose'),
  ('tumeur'),
  ('covid'),
  ('avc'),
  ('infarctus'),
  ('anorexie'),
  ('boulimie'),
  ('bipolarite'),
  ('toc'),
  ('addiction'),
  ('thyroide'),
  ('alzheimer'),
  ('parkinson'),
  ('epilepsie')
on conflict (word) do nothing;
