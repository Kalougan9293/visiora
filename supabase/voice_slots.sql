-- Voix et fond choisis par l'admin, sans redéploiement.
-- Les niveaux (gain, stabilité) restent ceux du créneau dans generate-session-audio.
-- Dashboard → SQL Editor, une fois.

create table if not exists public.voice_slots (
  slot text primary key,
  label text not null,
  eleven_voice_id text not null,
  bed text not null,
  preview_url text,
  dry_url text,
  updated_at timestamptz not null default now()
);

alter table public.voice_slots enable row level security;

drop policy if exists voice_slots_select on public.voice_slots;
create policy voice_slots_select
  on public.voice_slots
  for select
  to authenticated
  using (true);

grant select on public.voice_slots to authenticated;

insert into public.voice_slots (slot, label, eleven_voice_id, bed) values
  ('aurore', 'Aurore', 'ucMmKRQbfDEYyb2IIGax', 'antoni'),
  ('steve', 'Steve', 'jfEwztGDkpbpy89xeku6', 'antoni')
on conflict (slot) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-previews',
  'voice-previews',
  true,
  10485760,
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do update
set public = true;

drop policy if exists voice_previews_read on storage.objects;
create policy voice_previews_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'voice-previews');
