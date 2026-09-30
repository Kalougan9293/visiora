-- Fonds sonores des séances (lus par generate-session-audio via service role).
-- Une seule fois dans l’éditeur SQL Supabase, puis upload des WAV (voir scripts/upload-audio-beds.ps1).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'beds',
  'beds',
  false,
  52428800,
  array['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3']
)
on conflict (id) do nothing;
