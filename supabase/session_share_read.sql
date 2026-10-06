-- L’admin ne voit que les séances dont la personne a coché le partage.

create or replace function public.admin_list_shared_sessions()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  session_id uuid,
  title text,
  answers jsonb,
  script text,
  listens int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    s.id,
    s.title,
    s.answers,
    s.script,
    s.listens,
    s.created_at
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where s.answers->>'share_read' = '1'
    and coalesce(p.is_admin, false) = false
  order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_shared_sessions() from public, anon;
grant execute on function public.admin_list_shared_sessions() to authenticated;
