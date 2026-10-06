-- Un fond déposé par voix : custom/aurore-….wav ou custom/steve-….wav.

drop policy if exists beds_admin_insert on storage.objects;
create policy beds_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'beds'
    and name ~ '^custom/(aurore|steve)-[0-9]{10,16}\.wav$'
    and public.is_current_user_admin()
  );
