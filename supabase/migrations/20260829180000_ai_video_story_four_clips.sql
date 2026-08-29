-- prepare_ai_video_story_publication hardcoded "exactly 3 video clips",
-- true when intro was one clip. Splitting intro into introSetup +
-- introIncident (so each gets its own accurate image instead of one
-- static image spanning two emotional moments) means every AI video
-- story now has 4 video clips, not 3. Readiness must match reality.

create or replace function public.prepare_ai_video_story_publication(
  target_request_id uuid, target_actor_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  request_row private.ai_video_story_requests%rowtype;
  graph private.story_playback_graphs%rowtype;
  readiness record;
  video_renders jsonb;
  audio_renders jsonb;
  canonical jsonb;
  fingerprint text;
  video_manifest jsonb;
  audio_manifest jsonb;
  manifest jsonb;
  existing private.story_publications%rowtype;
  existing_found boolean;
  result_id uuid;
  result_status text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;

  select * into request_row from private.ai_video_story_requests
    where id = target_request_id and created_by = target_actor_id for update;
  if not found then raise exception 'AI video story request not found'; end if;
  if request_row.graph_id is null then raise exception 'AI video story graph is not ready'; end if;

  select * into graph from private.story_playback_graphs where id = request_row.graph_id;
  if not found then raise exception 'AI video story graph not found'; end if;

  if (select count(*) from private.story_clips where graph_id = graph.id and kind = 'decision') <> 2 then
    raise exception 'AI video story must have exactly two decision clips';
  end if;
  if exists (
    select 1 from private.story_clips c
    where c.graph_id = graph.id and c.kind = 'decision'
      and (jsonb_typeof(c.choice -> 'options') <> 'array' or jsonb_array_length(c.choice -> 'options') <> 2)
  ) then
    raise exception 'each AI video decision must have exactly two options';
  end if;
  if exists (
    select 1
    from private.story_clips c,
      lateral jsonb_array_elements(c.choice -> 'options') option
    where c.graph_id = graph.id and c.kind = 'decision'
      and not exists (
        select 1 from private.story_clips target
        where target.graph_id = graph.id and target.id = option ->> 'nextClipId'
      )
  ) then
    raise exception 'an AI video decision points to a missing clip';
  end if;

  select * into readiness from private.compute_story_media_readiness(graph.id);
  if readiness.total_clips <> 4
     or readiness.ready_clips <> readiness.total_clips
     or readiness.failed_clips <> 0
     or readiness.pending_clips <> 0
     or readiness.total_choice_audio <> 6
     or readiness.ready_choice_audio <> readiness.total_choice_audio
     or readiness.failed_choice_audio <> 0
     or readiness.pending_choice_audio <> 0
  then
    raise exception 'all four videos and six decision audio files must be ready before sharing';
  end if;
  if exists (
    select 1 from private.story_clips
    where graph_id = graph.id and kind <> 'decision' and (storage_path is null or render_id is null)
  ) or exists (
    select 1 from private.story_choice_media
    where graph_id = graph.id and (storage_path is null or render_id is null)
  ) then
    raise exception 'ready AI video media is missing durable storage identity';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'clipId', c.id, 'renderId', c.render_id, 'sourcePath', c.storage_path
  ) order by c.id), '[]'::jsonb)
  into video_renders
  from private.story_clips c
  where c.graph_id = graph.id and c.kind <> 'decision';

  select coalesce(jsonb_agg(jsonb_build_object(
    'decisionClipId', media.decision_clip_id, 'audioRole', media.audio_role,
    'choiceId', media.choice_id, 'renderId', media.render_id, 'sourcePath', media.storage_path
  ) order by media.decision_clip_id, media.audio_role, coalesce(media.choice_id, '')), '[]'::jsonb)
  into audio_renders
  from private.story_choice_media media
  where media.graph_id = graph.id;

  canonical := jsonb_build_object(
    'requestId', request_row.id, 'storyId', graph.story_id, 'graphId', graph.id,
    'plan', request_row.plan, 'videoRenders', video_renders, 'audioRenders', audio_renders
  );
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');

  select * into existing from private.story_publications
    where story_id = graph.story_id and publication_fingerprint = fingerprint;
  existing_found := found;

  if existing_found and existing.status = 'published' then
    update private.ai_video_story_requests
      set publication_id = existing.id, published_at = existing.published_at, updated_at = now()
      where id = request_row.id;
    return jsonb_build_object(
      'publicationId', existing.id, 'status', 'published',
      'fingerprint', fingerprint, 'copyManifest', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'video', 'clipId', c.id, 'renderId', c.render_id,
    'sourcePath', c.storage_path, 'durationMs', c.duration_ms,
    'destPath', 'stories/' || graph.story_id || '/' || fingerprint || '/clips/' || c.id || '.mp4'
  ) order by c.id), '[]'::jsonb)
  into video_manifest
  from private.story_clips c
  where c.graph_id = graph.id and c.kind <> 'decision';

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'audio', 'decisionClipId', media.decision_clip_id, 'audioRole', media.audio_role,
    'choiceId', media.choice_id, 'renderId', media.render_id,
    'sourcePath', media.storage_path, 'durationMs', media.duration_ms,
    'destPath', 'stories/' || graph.story_id || '/' || fingerprint || '/audio/' ||
      media.decision_clip_id || '-' || media.audio_role ||
      coalesce('-' || media.choice_id, '') || '.wav'
  ) order by media.decision_clip_id, media.audio_role, coalesce(media.choice_id, '')), '[]'::jsonb)
  into audio_manifest
  from private.story_choice_media media
  where media.graph_id = graph.id;

  manifest := video_manifest || audio_manifest;

  if existing_found then
    update private.story_publications
      set status = 'preparing', failed_reason = null,
          media_manifest = manifest, prepared_by = target_actor_id, prepared_at = now()
      where id = existing.id
      returning id, status into result_id, result_status;
  else
    begin
      insert into private.story_publications
        (story_id, story_version, graph_id, publication_fingerprint, media_manifest, prepared_by)
      values (graph.story_id, graph.story_version, graph.id, fingerprint, manifest, target_actor_id)
      returning id, status into result_id, result_status;
    exception when unique_violation then
      select id, status into result_id, result_status
      from private.story_publications
      where story_id = graph.story_id and publication_fingerprint = fingerprint;
    end;
  end if;

  update private.ai_video_story_requests
    set publication_id = result_id, updated_at = now()
    where id = request_row.id;

  return jsonb_build_object(
    'publicationId', result_id, 'status', result_status,
    'fingerprint', fingerprint, 'copyManifest', manifest
  );
end;
$$;

revoke all on function public.prepare_ai_video_story_publication(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_ai_video_story_publication(uuid, uuid) to service_role;

comment on function public.prepare_ai_video_story_publication(uuid, uuid) is
  'Freezes a ready two-decision, four-video-clip AI video graph into the existing private story publication lifecycle.';
