-- À exécuter dans le SQL Editor si admin.sql a déjà été lancé avant
-- (sinon ré-exécute simplement tout supabase/admin.sql)

create or replace function public.admin_delete_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_id is null then
    return false;
  end if;

  delete from storage.objects
  where bucket_id = 'audios'
    and (storage.foldername(name))[1] = target_id::text;

  delete from auth.users where id = target_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to anon, authenticated;
