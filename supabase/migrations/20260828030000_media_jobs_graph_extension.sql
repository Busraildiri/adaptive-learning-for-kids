-- Phase 4: connects media_jobs to the Phase 1 playback graph. Additive only
-- -- no column removed/renamed, existing single-scene jobs (graph_id null)
-- keep working exactly as before.

-- CREATE OR REPLACE FUNCTION cannot change a function's return type (Postgres
-- error 42P13) -- every RPC below whose RETURNS TABLE shape changes must be
-- dropped (by its exact old signature) first. create_media_job's parameter
-- *count* also changes; without dropping it first Postgres would silently
-- create a second overloaded function instead of replacing it.
drop function if exists public.create_media_job(text, text, text, text, jsonb);
drop function if exists public.list_media_jobs();
drop function if exists public.get_media_job(uuid);
drop function if exists public.claim_next_media_job();
drop function if exists public.update_media_job_status(uuid, text, integer, text, text);

alter table private.media_jobs
  add column graph_id uuid references private.story_playback_graphs(id),
  add column media_kind text not null default 'video' check (media_kind in ('video', 'audio')),
  add column audio_role text check (audio_role in ('question', 'choice')),
  add column choice_id text,
  -- Durable object-storage identity (Phase 3's deterministic path scheme).
  -- asset_url remains for backward compatibility only -- new graph jobs
  -- should treat storage_path as the source of truth and mint a fresh
  -- signed URL on demand instead of persisting a long-lived one (see
  -- get_media_job_asset_path() and apps/admin-web's signed-url route).
  add column storage_path text,
  -- Fencing token: assigned fresh by claim_next_media_job() on every claim.
  -- update_media_job_status() rejects an update whose expected_render_id
  -- doesn't match the job's current one -- protects against a slow/crashed
  -- worker's late update landing after requeue_stale_media_jobs() (or a
  -- manual retry) has handed the job to a different attempt.
  add column render_id uuid,
  add constraint media_jobs_audio_needs_role
    check (media_kind = 'video' or audio_role is not null),
  add constraint media_jobs_choice_needs_id
    check (audio_role <> 'choice' or choice_id is not null);

-- Duplicate-enqueue protection: at most one ACTIVE (queued/rendering/
-- uploading) job per (graph, target) identity. Scoped to graph_id is not
-- null so legacy single-scene job creation is entirely unaffected. This is
-- enforced by the unique index itself (not an app-level check-then-insert),
-- so it is race-free under concurrent creation -- create_media_job() below
-- catches the resulting unique_violation and returns the existing job id.
create unique index media_jobs_active_identity_idx
  on private.media_jobs (
    graph_id, scene_id, media_kind, coalesce(audio_role, ''), coalesce(choice_id, '')
  )
  where graph_id is not null and status in ('queued', 'rendering', 'uploading');

create index media_jobs_stale_scan_idx
  on private.media_jobs (status, updated_at)
  where status in ('rendering', 'uploading');

-- story_clips: add the durable per-clip storage identity + which render
-- attempt is currently active. video_url (Phase 1) is left as-is for
-- backward compat but new writes go through storage_path from here on.
alter table private.story_clips
  add column storage_path text,
  add column render_id uuid;

-- Per-decision-audio-asset active media state (question + each choice
-- option), mirroring story_clips' role for video clips. Deliberately NOT
-- folded into story_playback_graphs/story_clips.choice -- that stays pure
-- topology (Phase 4 also removes the audioUrl/imageUrl fields that had
-- leaked into ChoiceOption/Choice; see packages/media-schema).
create table private.story_choice_media (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null references private.story_playback_graphs(id) on delete cascade,
  decision_clip_id text not null,
  audio_role text not null check (audio_role in ('question', 'choice')),
  choice_id text,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'ready', 'failed')),
  storage_path text,
  duration_ms integer,
  error text,
  render_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_choice_media_choice_shape check (
    (audio_role = 'question' and choice_id is null)
    or (audio_role = 'choice' and choice_id is not null)
  )
);

create unique index story_choice_media_identity_idx
  on private.story_choice_media (graph_id, decision_clip_id, audio_role, coalesce(choice_id, ''));

revoke all on private.story_choice_media from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Redefined RPCs (return-type/parameter-list changes require CREATE OR
-- REPLACE with the full new signature -- same pattern used in Phase 1).
-- ---------------------------------------------------------------------

create or replace function public.create_media_job(
  target_story_id text, target_scene_id text, target_provider text, target_mode text,
  target_render_manifest jsonb,
  target_graph_id uuid default null,
  target_media_kind text default 'video',
  target_audio_role text default null,
  target_choice_id text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
  existing_id uuid;
  decision_choice jsonb;
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  if target_mode not in ('local_animation', 'static_image') then raise exception 'invalid mode'; end if;
  if jsonb_typeof(target_render_manifest) <> 'object' then
    raise exception 'render_manifest must be a JSON object';
  end if;
  if target_media_kind not in ('video', 'audio') then raise exception 'invalid media_kind'; end if;
  if target_media_kind = 'audio' and target_audio_role is null then
    raise exception 'audio_role required when media_kind = audio';
  end if;
  if target_audio_role is not null and target_audio_role not in ('question', 'choice') then
    raise exception 'invalid audio_role';
  end if;
  if target_audio_role = 'choice' and target_choice_id is null then
    raise exception 'choice_id required when audio_role = choice';
  end if;

  -- Server-side graph/clip/choice relationship validation -- a client
  -- cannot enqueue a job against a clip or choice id that doesn't actually
  -- belong to the named graph.
  if target_graph_id is not null then
    if not exists (select 1 from private.story_playback_graphs where id = target_graph_id) then
      raise exception 'unknown graph_id';
    end if;
    if target_media_kind = 'video' then
      if not exists (
        select 1 from private.story_clips where graph_id = target_graph_id and id = target_scene_id
      ) then
        raise exception 'clip % not found in graph %', target_scene_id, target_graph_id;
      end if;
    else
      select choice into decision_choice from private.story_clips
        where graph_id = target_graph_id and id = target_scene_id and kind = 'decision';
      if decision_choice is null then
        raise exception 'decision clip % not found in graph %', target_scene_id, target_graph_id;
      end if;
      if target_audio_role = 'choice' and not exists (
        select 1 from jsonb_array_elements(decision_choice -> 'options') opt
        where opt ->> 'id' = target_choice_id
      ) then
        raise exception 'choice_id % not found on decision clip %', target_choice_id, target_scene_id;
      end if;
    end if;
  end if;

  begin
    insert into private.media_jobs
      (story_id, scene_id, provider, mode, render_manifest, graph_id, media_kind,
       audio_role, choice_id, requested_by)
    values
      (target_story_id, target_scene_id, target_provider, target_mode, target_render_manifest,
       target_graph_id, target_media_kind, target_audio_role, target_choice_id, auth.uid())
    returning id into new_id;
    return new_id;
  exception when unique_violation then
    -- Duplicate enqueue: an active job for this exact identity already
    -- exists (the unique index caught it). Return that job instead of
    -- creating a second one. Retry/regenerate are unaffected: a *failed*
    -- job isn't "active" (not in queued/rendering/uploading), so retrying
    -- or regenerating after failure never hits this path.
    select id into existing_id from private.media_jobs
      where graph_id = target_graph_id and scene_id = target_scene_id and media_kind = target_media_kind
        and coalesce(audio_role, '') = coalesce(target_audio_role, '')
        and coalesce(choice_id, '') = coalesce(target_choice_id, '')
        and status in ('queued', 'rendering', 'uploading')
      limit 1;
    return existing_id;
  end;
end;
$$;

create or replace function public.list_media_jobs()
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  graph_id uuid, media_kind text, audio_role text, choice_id text, storage_path text, render_id uuid,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select j.id, j.story_id, j.scene_id, j.provider, j.mode, j.render_manifest,
    j.graph_id, j.media_kind, j.audio_role, j.choice_id, j.storage_path, j.render_id,
    j.status, j.progress, j.asset_url, j.error, j.requested_by, j.created_at, j.updated_at
  from private.media_jobs j
  order by j.created_at desc;
end;
$$;

create or replace function public.get_media_job(target_job_id uuid)
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  graph_id uuid, media_kind text, audio_role text, choice_id text, storage_path text, render_id uuid,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select j.id, j.story_id, j.scene_id, j.provider, j.mode, j.render_manifest,
    j.graph_id, j.media_kind, j.audio_role, j.choice_id, j.storage_path, j.render_id,
    j.status, j.progress, j.asset_url, j.error, j.requested_by, j.created_at, j.updated_at
  from private.media_jobs j
  where j.id = target_job_id;
end;
$$;

create or replace function public.claim_next_media_job()
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  graph_id uuid, media_kind text, audio_role text, choice_id text, storage_path text, render_id uuid,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare claimed_id uuid; new_render_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  select m.id into claimed_id from private.media_jobs m
    where m.status = 'queued'
    order by m.created_at asc
    for update skip locked
    limit 1;
  if claimed_id is null then return; end if;
  new_render_id := gen_random_uuid();
  return query
  update private.media_jobs m set
    status = 'rendering', progress = 25, render_id = new_render_id, updated_at = now()
    where m.id = claimed_id
    returning m.id, m.story_id, m.scene_id, m.provider, m.mode, m.render_manifest,
      m.graph_id, m.media_kind, m.audio_role, m.choice_id, m.storage_path, m.render_id,
      m.status, m.progress, m.asset_url, m.error, m.requested_by, m.created_at, m.updated_at;
end;
$$;

create or replace function public.update_media_job_status(
  target_job_id uuid, new_status text, new_progress integer default null,
  new_asset_url text default null, new_error text default null,
  new_storage_path text default null, expected_render_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare current_render_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if new_status not in (
    'queued', 'generating_audio', 'planning_scenes', 'generating_visuals',
    'rendering', 'uploading', 'ready', 'failed'
  ) then raise exception 'invalid status'; end if;

  -- Fencing: only enforced when the caller passes expected_render_id (new
  -- worker code always does; old callers omitting it keep prior behavior).
  if expected_render_id is not null then
    select render_id into current_render_id from private.media_jobs where id = target_job_id;
    if current_render_id is distinct from expected_render_id then
      raise exception 'render_id mismatch: job % was reclaimed by another render attempt', target_job_id;
    end if;
  end if;

  update private.media_jobs set
    status = new_status,
    progress = coalesce(new_progress, progress),
    asset_url = coalesce(new_asset_url, asset_url),
    storage_path = coalesce(new_storage_path, storage_path),
    error = new_error,
    updated_at = now()
  where id = target_job_id;
  if not found then raise exception 'media job not found'; end if;
end;
$$;

-- service_role-only: retries reset a *failed* job back to queued with a
-- cleared render_id (a fresh one is assigned on the next claim) -- same job
-- row, same immutable render_manifest snapshot. Admin-triggered (through
-- admin-web, using the user's own session), not the worker itself.
create or replace function public.retry_media_job(target_job_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  update private.media_jobs
  set status = 'queued', progress = 0, error = null, render_id = null, updated_at = now()
  where id = target_job_id and status = 'failed';
  if not found then raise exception 'no failed job with that id (already retried or not failed)'; end if;
end;
$$;

-- service_role-only, manual/operational tool -- NOT auto-invoked by worker
-- startup. No hard-coded timeout: caller supplies cutoff_interval, since a
-- genuinely slow HyperFrames render must not be guessed at from inside this
-- migration. Clearing render_id means a late update from the original
-- worker attempt is rejected by update_media_job_status()'s fencing check
-- once a new worker claims the requeued job.
create or replace function public.requeue_stale_media_jobs(
  cutoff_interval interval, max_rows integer default 100
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare requeued_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if cutoff_interval is null then raise exception 'cutoff_interval is required'; end if;
  with stale as (
    select id from private.media_jobs
    where status in ('rendering', 'uploading')
      and updated_at < now() - cutoff_interval
    order by updated_at asc
    limit greatest(max_rows, 0)
    for update skip locked
  )
  update private.media_jobs m
  set status = 'queued', progress = 0, render_id = null,
    error = 'requeued: stale render attempt', updated_at = now()
  from stale
  where m.id = stale.id;
  get diagnostics requeued_count = row_count;
  return requeued_count;
end;
$$;

-- service_role-only: writes a video clip's active media state. Separate
-- from update_media_job_status -- that updates the job/attempt row, this
-- updates the graph's "what's currently active" row.
create or replace function public.update_story_clip_media_state(
  target_graph_id uuid, target_clip_id text, new_status text,
  new_storage_path text default null, new_duration_ms integer default null,
  new_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if new_status not in ('pending', 'rendering', 'ready', 'failed') then
    raise exception 'invalid status';
  end if;
  update private.story_clips set
    status = new_status,
    storage_path = coalesce(new_storage_path, storage_path),
    duration_ms = coalesce(new_duration_ms, duration_ms),
    error = new_error,
    updated_at = now()
  where graph_id = target_graph_id and id = target_clip_id;
  if not found then raise exception 'clip % not found in graph %', target_clip_id, target_graph_id; end if;
end;
$$;

-- service_role-only: upserts a decision question/choice's active audio
-- state (first render for that identity inserts, later renders update).
create or replace function public.update_choice_media_state(
  target_graph_id uuid, target_decision_clip_id text, target_audio_role text, target_choice_id text,
  new_status text, new_storage_path text default null, new_duration_ms integer default null,
  new_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if new_status not in ('pending', 'rendering', 'ready', 'failed') then
    raise exception 'invalid status';
  end if;
  if target_audio_role not in ('question', 'choice') then raise exception 'invalid audio_role'; end if;
  if target_audio_role = 'choice' and target_choice_id is null then
    raise exception 'choice_id required when audio_role = choice';
  end if;

  insert into private.story_choice_media
    (graph_id, decision_clip_id, audio_role, choice_id, status, storage_path, duration_ms, error)
  values
    (target_graph_id, target_decision_clip_id, target_audio_role, target_choice_id,
     new_status, new_storage_path, new_duration_ms, new_error)
  on conflict (graph_id, decision_clip_id, audio_role, coalesce(choice_id, ''))
  do update set
    status = excluded.status,
    storage_path = coalesce(excluded.storage_path, private.story_choice_media.storage_path),
    duration_ms = coalesce(excluded.duration_ms, private.story_choice_media.duration_ms),
    error = excluded.error,
    updated_at = now();
end;
$$;

-- Read-only, derived from granular clip/choice-audio state -- never stored
-- as a mutable aggregate column.
create or replace function public.get_story_media_readiness(target_graph_id uuid)
returns table (
  total_clips integer, ready_clips integer, failed_clips integer, pending_clips integer,
  total_choice_audio integer, ready_choice_audio integer, failed_choice_audio integer,
  pending_choice_audio integer
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select
    (select count(*)::int from private.story_clips
      where graph_id = target_graph_id and kind <> 'decision'),
    (select count(*)::int from private.story_clips
      where graph_id = target_graph_id and kind <> 'decision' and status = 'ready'),
    (select count(*)::int from private.story_clips
      where graph_id = target_graph_id and kind <> 'decision' and status = 'failed'),
    (select count(*)::int from private.story_clips
      where graph_id = target_graph_id and kind <> 'decision' and status in ('pending', 'rendering')),
    (select count(*)::int from private.story_choice_media where graph_id = target_graph_id),
    (select count(*)::int from private.story_choice_media
      where graph_id = target_graph_id and status = 'ready'),
    (select count(*)::int from private.story_choice_media
      where graph_id = target_graph_id and status = 'failed'),
    (select count(*)::int from private.story_choice_media
      where graph_id = target_graph_id and status in ('pending', 'rendering'));
end;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

grant execute on function public.create_media_job(text, text, text, text, jsonb, uuid, text, text, text)
  to authenticated;
grant execute on function public.list_media_jobs() to authenticated;
grant execute on function public.get_media_job(uuid) to authenticated;
grant execute on function public.retry_media_job(uuid) to authenticated;
grant execute on function public.get_story_media_readiness(uuid) to authenticated;

revoke all on function public.claim_next_media_job() from public, anon, authenticated;
grant execute on function public.claim_next_media_job() to service_role;
revoke all on function public.update_media_job_status(uuid, text, integer, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_media_job_status(uuid, text, integer, text, text, text, uuid)
  to service_role;
revoke all on function public.requeue_stale_media_jobs(interval, integer) from public, anon, authenticated;
grant execute on function public.requeue_stale_media_jobs(interval, integer) to service_role;
revoke all on function public.update_story_clip_media_state(uuid, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.update_story_clip_media_state(uuid, text, text, text, integer, text)
  to service_role;
revoke all on function public.update_choice_media_state(uuid, text, text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.update_choice_media_state(uuid, text, text, text, text, text, integer, text)
  to service_role;

comment on table private.story_choice_media is
  'Active render state for decision question/choice audio (one row per
   graph+decisionClip+audioRole+choiceId identity). Mirrors the role
   story_clips plays for video clips. Never merged into
   story_playback_graphs/story_clips topology -- see Phase 4 write-up for
   the ChoiceOption.audioUrl cleanup this motivated.';
comment on column private.media_jobs.render_id is
  'Fencing token assigned at claim time. update_media_job_status() rejects
   an update carrying a stale expected_render_id -- protects against a slow
   or crashed worker''s late update landing after requeue_stale_media_jobs()
   or retry_media_job() has handed the job to a different attempt.';
