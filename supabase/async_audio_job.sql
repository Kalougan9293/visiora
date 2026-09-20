-- Visiora — job audio asynchrone (chunks + reprise)
-- À exécuter dans : Supabase Dashboard → SQL Editor

alter table public.sessions
  add column if not exists audio_job jsonb;

comment on column public.sessions.audio_job is
  'État du pipeline TTS découpé (steps, nextIndex, parts) pour reprise sans re-facturer ElevenLabs';
