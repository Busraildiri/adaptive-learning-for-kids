-- Phase 6 blocker fix (two related, minimal corrections to the existing
-- Phase 1/4 persistence contract, both exposed by Phase 6's PREPARE gate):
--
-- 1. story_choice_media previously only ever gained a row when a worker
--    completed a job (update_choice_media_state's upsert, called once, at
--    the end). A decision-audio unit nobody had started yet was therefore
--    invisible to readiness rather than counted as outstanding -- a
--    missing row silently meant "not required" instead of "not ready".
--    Fixed at the earliest correct point: create_story_playback_graph now
--    pre-populates one 'pending' row per required decision-audio target
--    (question + every option), reusing the same choice.options the
--    caller already supplies for topology -- never a hardcoded count.
--    The existing upsert in update_choice_media_state then updates these
--    rows in place as jobs progress/complete; no change needed there for
--    this half of the fix.
--
-- 2. story_clips.render_id / story_choice_media.render_id have existed
--    since Phase 4 but were never written -- worker.py already has the
--    render_id in scope at completion time (the same fencing token
--    claim_next_media_job assigned), it just wasn't threaded through
--    update_story_clip_media_state / update_choice_media_state. Fixed by
--    adding one more optional parameter to each, exactly like
--    new_storage_path/new_duration_ms already are, and passing it from
--    worker.py's two call sites (services/media-worker/media_worker/worker.py).

drop function if exists public.create_story_playback_graph(text, integer, text, text, jsonb);

create or replace function public.create_story_playback_graph(
  target_story_id text,
  target_story_version integer,
  target_source_request_id text,
  target_start_clip_id text,
  target_clips jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_graph_id uuid;
  clip jsonb;
  option jsonb;
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  if jsonb_typeof(target_clips) <> 'array' or jsonb_array_length(target_clips) < 1 then
    raise exception 'clips must be a non-empty JSON array';
  end if;

  insert into private.story_playback_graphs
    (story_id, story_version, source_request_id, start_clip_id)
  values (target_story_id, target_story_version, target_source_request_id, target_start_clip_id)
  returning id into new_graph_id;

  for clip in select * from jsonb_array_elements(target_clips)
  loop
    if clip ->> 'kind' not in ('linear', 'decision', 'ending') then
      raise exception 'invalid clip kind: %', clip ->> 'kind';
    end if;
    insert into private.story_clips
      (graph_id, id, kind, source_scene_id, role, next_clip_id, choice)
    values (
      new_graph_id,
      clip ->> 'id',
      clip ->> 'kind',
      clip ->> 'sourceSceneId',
      clip ->> 'role',
      clip ->> 'nextClipId',
      clip -> 'choice'
    );

    -- The required decision-audio inventory (question + every option) is
    -- known in full the moment the graph exists -- pre-create it as
    -- 'pending' rather than waiting for the first job to complete.
    if clip ->> 'kind' = 'decision' then
      insert into private.story_choice_media (graph_id, decision_clip_id, audio_role, choice_id)
      values (new_graph_id, clip ->> 'id', 'question', null);

      for option in select * from jsonb_array_elements(clip -> 'choice' -> 'options')
      loop
        insert into private.story_choice_media (graph_id, decision_clip_id, audio_role, choice_id)
        values (new_graph_id, clip ->> 'id', 'choice', option ->> 'id');
      end loop;
    end if;
  end loop;

  return new_graph_id;
end;
$$;

grant execute on function public.create_story_playback_graph(text, integer, text, text, jsonb)
  to authenticated;

-- render_id persistence: additive parameter, backward compatible for any
-- caller (worker.py included) that omits it -- named-parameter RPC calls
-- simply don't include the key and the default (null, meaning "leave
-- whatever is already there via coalesce") applies.

drop function if exists public.update_story_clip_media_state(uuid, text, text, text, integer, text);

create or replace function public.update_story_clip_media_state(
  target_graph_id uuid, target_clip_id text, new_status text,
  new_storage_path text default null, new_duration_ms integer default null,
  new_error text default null, new_render_id uuid default null
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
    render_id = coalesce(new_render_id, render_id),
    updated_at = now()
  where graph_id = target_graph_id and id = target_clip_id;
  if not found then raise exception 'clip % not found in graph %', target_clip_id, target_graph_id; end if;
end;
$$;

drop function if exists public.update_choice_media_state(uuid, text, text, text, text, text, integer, text);

create or replace function public.update_choice_media_state(
  target_graph_id uuid, target_decision_clip_id text, target_audio_role text, target_choice_id text,
  new_status text, new_storage_path text default null, new_duration_ms integer default null,
  new_error text default null, new_render_id uuid default null
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

  -- Upserts the pre-populated 'pending' row into place (the common case,
  -- once this migration has run) or inserts fresh (only for rows that
  -- predate this migration and were never pre-created).
  insert into private.story_choice_media
    (graph_id, decision_clip_id, audio_role, choice_id, status, storage_path, duration_ms, error, render_id)
  values
    (target_graph_id, target_decision_clip_id, target_audio_role, target_choice_id,
     new_status, new_storage_path, new_duration_ms, new_error, new_render_id)
  on conflict (graph_id, decision_clip_id, audio_role, coalesce(choice_id, ''))
  do update set
    status = excluded.status,
    storage_path = coalesce(excluded.storage_path, private.story_choice_media.storage_path),
    duration_ms = coalesce(excluded.duration_ms, private.story_choice_media.duration_ms),
    error = excluded.error,
    render_id = coalesce(excluded.render_id, private.story_choice_media.render_id),
    updated_at = now();
end;
$$;

revoke all on function public.update_story_clip_media_state(uuid, text, text, text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_story_clip_media_state(uuid, text, text, text, integer, text, uuid)
  to service_role;
revoke all on function public.update_choice_media_state(uuid, text, text, text, text, text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_choice_media_state(uuid, text, text, text, text, text, integer, text, uuid)
  to service_role;

comment on function public.create_story_playback_graph(text, integer, text, text, jsonb) is
  'Also pre-populates private.story_choice_media with one pending row per
   required decision-audio target (question + every choice option), so
   readiness/publication can see the full expected inventory from graph
   creation onward instead of only after the first job completes.';
