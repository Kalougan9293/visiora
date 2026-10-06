-- Une voix ajoutée dans l’admin dépose son fond sous custom/v…-….wav.

drop policy if exists beds_admin_insert on storage.objects;
create policy beds_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'beds'
    and name ~ '^custom/(aurore|steve|v[0-9]{10,16})-[0-9]{10,16}\.wav$'
    and public.is_current_user_admin()
  );
