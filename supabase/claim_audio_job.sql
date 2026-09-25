-- Un seul passage audio à la fois. Le service role est le seul appelant.

create or replace function public.claim_session_audio(
  p_session uuid,
  p_job jsonb,
  p_bytes integer,
  p_mode text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_mode = 'install' then
    update public.sessions
    set audio_job = p_job,
        audio_bytes = p_bytes,
        status = 'generating',
        audio_path = null,
        audio_url = null,
        updated_at = now()
    where id = p_session
      and status <> 'ready'
      and (audio_job is null or audio_job->>'phase' = 'n8n');
  elsif p_mode = 'replace' then
    update public.sessions
    set audio_job = p_job,
        audio_bytes = p_bytes,
        status = 'generating',
        audio_path = null,
        audio_url = null,
        updated_at = now()
    where id = p_session
      and status <> 'ready';
  else
    update public.sessions
    set audio_job = p_job,
        audio_bytes = p_bytes,
        status = 'generating',
        updated_at = now()
    where id = p_session
      and status <> 'ready'
      and audio_job is not null
      and audio_job->>'phase' is distinct from 'n8n'
      and (
        coalesce(audio_job->>'claimId', '') = ''
        or audio_job->>'claimedAt' is null
        or (audio_job->>'claimedAt')::timestamptz < now() - interval '90 seconds'
      );
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.claim_session_audio(uuid, jsonb, integer, text) from public;
revoke all on function public.claim_session_audio(uuid, jsonb, integer, text) from anon;
revoke all on function public.claim_session_audio(uuid, jsonb, integer, text) from authenticated;
grant execute on function public.claim_session_audio(uuid, jsonb, integer, text) to service_role;
