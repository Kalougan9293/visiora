-- Promote Visiora admins (run via service / db query; auth.uid() is null)
update public.profiles
set is_admin = true
where lower(email) in (
  'jona_92100@hotmail.com',
  'jonathanvillette25@gmail.com'
);

select id, email, is_admin
from public.profiles
where lower(email) in (
  'jona_92100@hotmail.com',
  'jonathanvillette25@gmail.com'
)
or is_admin = true;
