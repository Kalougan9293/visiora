-- Nom du fond affiché dans l’admin, et dépôt d’un fichier par l’admin.
-- Le fond en place reste Sleep Music (fichier antoni) tant qu’aucun fichier n’est envoyé.

alter table public.voice_slots add column if not exists bed_label text;

update public.voice_slots
set bed_label = 'Sleep Music'
where bed_label is null;

drop policy if exists beds_admin_insert on storage.objects;
create policy beds_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'beds'
    and name ~ '^custom/bed-[0-9]{10,16}\.wav$'
    and public.is_current_user_admin()
  );
