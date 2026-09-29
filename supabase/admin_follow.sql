-- Suivi des testeurs (mesures d'usage, sans script ni questionnaire).
-- À coller une fois dans Supabase → SQL Editor, après schema, phase1, metrics et cdc_listens.
-- Le déploiement du site ne crée pas ces fonctions.

alter table public.profiles add column if not exists client_label text;
alter table public.sessions add column if not exists usage jsonb;

create or replace function public.visiora_script_words(src text)
returns int
language sql
immutable
as $$
  select case
    when src is null or btrim(src) = '' then null
    else cardinality(
      regexp_split_to_array(
        btrim(regexp_replace(regexp_replace(src, '\[[^\]]*\]', ' ', 'g'), '\s+', ' ', 'g')),
        ' '
      )
    )
  end;
$$;

create or replace function public.visiora_usage_int(bag jsonb, key text)
returns int
language sql
immutable
as $$
  select case
    when coalesce(bag->>key, '') ~ '^[0-9]+$' then (bag->>key)::int
    else null
  end;
$$;

create or replace function public.visiora_generation_seconds(usage jsonb, job jsonb)
returns int
language plpgsql
stable
as $$
declare
  raw_start text;
  raw_end text;
  started timestamptz;
  finished timestamptz;
begin
  raw_start := coalesce(nullif(usage->>'startedAt', ''), nullif(job->>'startedAt', ''));
  raw_end := coalesce(nullif(usage->>'finishedAt', ''), nullif(job->>'finishedAt', ''));
  if raw_start is null or raw_end is null then
    return null;
  end if;
  if raw_start !~ '^\d{4}-\d{2}-\d{2}' or raw_end !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  started := raw_start::timestamptz;
  finished := raw_end::timestamptz;
  return greatest(0, round(extract(epoch from (finished - started))))::int;
exception
  when others then
    return null;
end;
$$;

create or replace function public.admin_follow_testers()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  with people as (
    select
      p.id,
      p.first_name,
      p.email,
      p.created_at,
      p.last_seen_at,
      coalesce(p.share_sessions, false) as share_sessions,
      nullif(btrim(p.client_label), '') as client_label,
      (select count(*)::int from public.sessions s where s.user_id = p.id) as session_count,
      (select coalesce(sum(s.listens), 0)::int from public.sessions s where s.user_id = p.id) as listen_count,
      (
        select count(distinct l.listened_on)::int
        from public.listens l
        where l.user_id = p.id
      ) as practice_days,
      (
        select coalesce(sum(s.audio_bytes), 0)::bigint
        from public.sessions s
        where s.user_id = p.id
          and s.status = 'ready'
          and coalesce(s.audio_bytes, 0) > 1000
      ) as storage_bytes
    from public.profiles p
    where coalesce(p.is_admin, false) = false
  ),
  sheets as (
    select
      s.id,
      s.user_id,
      s.title,
      s.created_at,
      s.status,
      s.voice_id,
      case
        when s.answers->>'q12_registre' in ('neutre', 'spirituel') then s.answers->>'q12_registre'
        else null
      end as register,
      case
        when s.status = 'ready' and coalesce(s.audio_bytes, 0) > 1000 then s.audio_bytes
        else null
      end as file_bytes,
      case
        when coalesce(s.answers->>'q6_scale', '') ~ '^[0-9]+([.,][0-9]+)?$'
        then round(replace(s.answers->>'q6_scale', ',', '.')::numeric)::int
        else null
      end as scale_before,
      coalesce(nullif(s.usage->>'promptVersion', ''), nullif(s.audio_job->>'promptVersion', '')) as prompt_version,
      coalesce(
        public.visiora_usage_int(s.usage, 'scriptWords'),
        public.visiora_script_words(s.script)
      ) as script_words,
      public.visiora_generation_seconds(s.usage, s.audio_job) as generation_seconds,
      left(
        coalesce(nullif(s.usage->>'error', ''), nullif(s.audio_job->>'error', '')),
        180
      ) as error,
      coalesce(
        public.visiora_usage_int(s.usage, 'ttsChars'),
        public.visiora_usage_int(s.audio_job, 'ttsChars')
      ) as tts_chars,
      coalesce(
        public.visiora_usage_int(s.usage, 'llmPromptTokens'),
        public.visiora_usage_int(s.audio_job, 'llmPromptTokens')
      ) as llm_prompt_tokens,
      coalesce(
        public.visiora_usage_int(s.usage, 'llmCompletionTokens'),
        public.visiora_usage_int(s.audio_job, 'llmCompletionTokens')
      ) as llm_completion_tokens,
      (
        select max(lp.duration_seconds)
        from public.listen_plays lp
        where lp.session_id = s.id
          and lp.duration_seconds > 1
      ) as listened_seconds,
      case
        when s.status = 'ready' and coalesce(s.audio_bytes, 0) > 1000
        then round(s.audio_bytes * 8.0 / 128000)::int
        else null
      end as estimated_seconds,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'scale', f.scale,
            'created_at', f.created_at,
            'remark', case
              when coalesce(p.share_sessions, false) then nullif(btrim(f.remark), '')
              else null
            end
          )
          order by f.created_at desc
        )
        from (
          select fb.scale, fb.remark, fb.created_at
          from public.listen_feedback fb
          where fb.session_id = s.id
          order by fb.created_at desc
          limit 8
        ) f
      ), '[]'::jsonb) as notes
    from public.sessions s
    join public.profiles p on p.id = s.user_id
    where coalesce(p.is_admin, false) = false
  ),
  plays as (
    select
      lp.id,
      lp.user_id,
      lp.session_id,
      lp.started_at,
      lp.max_seconds,
      lp.duration_seconds,
      lp.completed
    from public.listen_plays lp
    join public.profiles p on p.id = lp.user_id
    where coalesce(p.is_admin, false) = false
    order by lp.started_at desc
    limit 2000
  )
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(people) order by people.created_at desc) from people), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(sheets) order by sheets.created_at desc) from sheets), '[]'::jsonb),
    'plays', coalesce((select jsonb_agg(to_jsonb(plays) order by plays.started_at desc) from plays), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.visiora_script_words(text) from public, anon, authenticated;
revoke all on function public.visiora_usage_int(jsonb, text) from public, anon, authenticated;
revoke all on function public.visiora_generation_seconds(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.admin_follow_testers() from public, anon;
grant execute on function public.admin_follow_testers() to authenticated;
