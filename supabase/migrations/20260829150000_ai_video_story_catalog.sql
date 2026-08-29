alter table private.ai_video_story_requests
  add column publication_id uuid references private.story_publications(id) on delete set null,
  add column published_at timestamptz;

create index ai_video_story_requests_publication_idx
  on private.ai_video_story_requests(publication_id)
  where publication_id is not null;

create or replace function public.list_ai_video_story_requests(target_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', r.id,
    'storyId', r.story_id,
    'characterName', r.character_name,
    'status', case
      when r.status = 'failed' or coalesce(media.failed_clips, 0) + coalesce(media.failed_choice_audio, 0) > 0 then 'failed'
      when coalesce(media.total_clips, 0) + coalesce(media.total_choice_audio, 0) > 0
        and coalesce(media.ready_clips, 0) = coalesce(media.total_clips, 0)
        and coalesce(media.ready_choice_audio, 0) = coalesce(media.total_choice_audio, 0) then 'ready'
      when jobs.has_active then 'rendering'
      else r.status
    end,
    'error', coalesce(r.error, jobs.first_error),
    'graphId', r.graph_id,
    'plan', r.plan,
    'publicationId', r.publication_id,
    'publicationStatus', coalesce(publication.status, 'draft'),
    'publishedAt', r.published_at,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'readiness', case when r.graph_id is null then null else jsonb_build_object(
      'total_clips', media.total_clips,
      'ready_clips', media.ready_clips,
      'failed_clips', media.failed_clips,
      'pending_clips', media.pending_clips,
      'total_choice_audio', media.total_choice_audio,
      'ready_choice_audio', media.ready_choice_audio,
      'failed_choice_audio', media.failed_choice_audio,
      'pending_choice_audio', media.pending_choice_audio
    ) end,
    'jobs', coalesce(jobs.items, '[]'::jsonb)
  ) order by r.created_at desc), '[]'::jsonb)
  into result
  from private.ai_video_story_requests r
  left join private.story_publications publication on publication.id = r.publication_id
  left join lateral (
    select * from private.compute_story_media_readiness(r.graph_id)
  ) media on r.graph_id is not null
  left join lateral (
    select
      coalesce(bool_or(j.status in (
        'generating_audio', 'planning_scenes', 'generating_visuals', 'rendering', 'uploading'
      )), false) as has_active,
      min(j.error) filter (where j.error is not null) as first_error,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', j.id, 'scene_id', j.scene_id, 'media_kind', j.media_kind,
        'status', j.status, 'error', j.error
      ) order by j.created_at), '[]'::jsonb) as items
    from private.media_jobs j
    where j.graph_id = r.graph_id
  ) jobs on true
  where r.created_by = target_actor_id;

  return result;
end;
$$;

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
  if readiness.total_clips <> 3
     or readiness.ready_clips <> readiness.total_clips
     or readiness.failed_clips <> 0
     or readiness.pending_clips <> 0
     or readiness.total_choice_audio <> 6
     or readiness.ready_choice_audio <> readiness.total_choice_audio
     or readiness.failed_choice_audio <> 0
     or readiness.pending_choice_audio <> 0
  then
    raise exception 'all three videos and six decision audio files must be ready before sharing';
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

create or replace function public.finalize_ai_video_story_publication(
  target_publication_id uuid, target_actor_id uuid, confirmed_object_paths text[]
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  publication private.story_publications%rowtype;
  request_row private.ai_video_story_requests%rowtype;
  graph private.story_playback_graphs%rowtype;
  expected_paths text[];
  confirmed_sorted text[];
  built_clips jsonb;
  experience_payload jsonb;
  next_version integer;
  finalized_at timestamptz := now();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;

  select * into publication from private.story_publications
    where id = target_publication_id for update;
  if not found then raise exception 'AI video publication not found'; end if;

  select * into request_row from private.ai_video_story_requests
    where publication_id = publication.id and created_by = target_actor_id for update;
  if not found then raise exception 'AI video story request for publication not found'; end if;

  if publication.status = 'published' then
    return jsonb_build_object(
      'publicationId', publication.id, 'status', 'published',
      'publishedVersion', publication.published_version,
      'publishedAt', publication.published_at, 'experience', publication.experience
    );
  end if;
  if publication.status <> 'preparing' then
    raise exception 'AI video publication is not finalizable';
  end if;

  select array_agg(entry ->> 'destPath' order by entry ->> 'destPath')
    into expected_paths from jsonb_array_elements(publication.media_manifest) entry;
  select array_agg(path order by path) into confirmed_sorted
    from unnest(confirmed_object_paths) path;
  if confirmed_sorted is distinct from expected_paths then
    raise exception 'confirmed object paths do not match the AI video publication manifest';
  end if;

  select * into graph from private.story_playback_graphs where id = publication.graph_id;
  if not found then raise exception 'AI video graph no longer exists'; end if;

  select jsonb_agg(
    case clip.kind
      when 'decision' then jsonb_build_object(
        'kind', 'decision', 'id', clip.id,
        'question', jsonb_build_object(
          'text', clip.choice ->> 'question',
          'audio', (
            select jsonb_build_object(
              'mediaRef', entry ->> 'destPath',
              'durationMs', (entry ->> 'durationMs')::int
            )
            from jsonb_array_elements(publication.media_manifest) entry
            where entry ->> 'kind' = 'audio'
              and entry ->> 'decisionClipId' = clip.id
              and entry ->> 'audioRole' = 'question'
          )
        ),
        'options', (
          select jsonb_agg(jsonb_build_object(
            'id', option ->> 'id', 'label', option ->> 'label',
            'nextClipId', option ->> 'nextClipId',
            'audio', (
              select jsonb_build_object(
                'mediaRef', entry ->> 'destPath',
                'durationMs', (entry ->> 'durationMs')::int
              )
              from jsonb_array_elements(publication.media_manifest) entry
              where entry ->> 'kind' = 'audio'
                and entry ->> 'decisionClipId' = clip.id
                and entry ->> 'audioRole' = 'choice'
                and entry ->> 'choiceId' = option ->> 'id'
            )
          ) order by option ->> 'id')
          from jsonb_array_elements(clip.choice -> 'options') option
        )
      )
      when 'linear' then jsonb_build_object(
        'kind', 'linear', 'id', clip.id, 'nextClipId', clip.next_clip_id,
        'video', (
          select jsonb_build_object(
            'mediaRef', entry ->> 'destPath',
            'durationMs', (entry ->> 'durationMs')::int
          )
          from jsonb_array_elements(publication.media_manifest) entry
          where entry ->> 'kind' = 'video' and entry ->> 'clipId' = clip.id
        )
      )
      else jsonb_build_object(
        'kind', 'ending', 'id', clip.id,
        'video', (
          select jsonb_build_object(
            'mediaRef', entry ->> 'destPath',
            'durationMs', (entry ->> 'durationMs')::int
          )
          from jsonb_array_elements(publication.media_manifest) entry
          where entry ->> 'kind' = 'video' and entry ->> 'clipId' = clip.id
        )
      )
    end order by clip.id
  ) into built_clips
  from private.story_clips clip
  where clip.graph_id = graph.id;

  perform pg_advisory_xact_lock(hashtext(publication.story_id)::bigint);
  select coalesce(max(published_version), 0) + 1 into next_version
  from private.story_publications
  where story_id = publication.story_id and status = 'published';

  experience_payload := jsonb_build_object(
    'storyId', publication.story_id,
    'storyVersion', graph.story_version,
    'publishedVersion', next_version,
    'experienceType', 'video_branching',
    'title', request_row.plan ->> 'title',
    'characterName', request_row.character_name,
    'greetingTemplate', request_row.character_name || ' hikâyesine hoş geldin, {{childName}}!',
    'ageBands', jsonb_build_array('2-4'),
    'startClipId', graph.start_clip_id,
    'coverMediaRef', (
      select entry ->> 'destPath'
      from jsonb_array_elements(publication.media_manifest) entry
      where entry ->> 'kind' = 'video' and entry ->> 'clipId' = graph.start_clip_id
    ),
    'clips', built_clips,
    'publishedAt', to_jsonb(finalized_at)
  );

  update private.story_publications
    set status = 'published', published_version = next_version,
        experience = experience_payload, published_at = finalized_at
    where id = publication.id;
  update private.ai_video_story_requests
    set published_at = finalized_at, updated_at = finalized_at
    where id = request_row.id;

  return jsonb_build_object(
    'publicationId', publication.id, 'status', 'published',
    'publishedVersion', next_version, 'publishedAt', finalized_at,
    'experience', experience_payload
  );
end;
$$;

create or replace function public.delete_ai_video_story_request(
  target_request_id uuid, target_actor_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  request_row private.ai_video_story_requests%rowtype;
  source_paths text[];
  published_paths text[];
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;

  select * into request_row from private.ai_video_story_requests
    where id = target_request_id and created_by = target_actor_id for update;
  if not found then raise exception 'AI video story request not found'; end if;

  perform 1 from private.media_jobs where graph_id = request_row.graph_id for update;
  if exists (
    select 1 from private.media_jobs
    where graph_id = request_row.graph_id
      and status in ('generating_audio', 'planning_scenes', 'generating_visuals', 'rendering', 'uploading')
  ) then
    raise exception 'AI video story cannot be deleted while media is rendering';
  end if;

  select array_agg(distinct path) into source_paths
  from (
    select storage_path as path from private.media_jobs where graph_id = request_row.graph_id
    union all
    select storage_path from private.story_clips where graph_id = request_row.graph_id
    union all
    select storage_path from private.story_choice_media where graph_id = request_row.graph_id
  ) paths where path is not null;

  select array_agg(distinct entry ->> 'destPath') into published_paths
  from private.story_publications publication,
    lateral jsonb_array_elements(publication.media_manifest) entry
  where publication.graph_id = request_row.graph_id;

  delete from private.story_publications where graph_id = request_row.graph_id;
  delete from private.media_jobs where graph_id = request_row.graph_id;
  delete from private.ai_video_story_requests where id = request_row.id;
  if request_row.graph_id is not null then
    delete from private.story_playback_graphs where id = request_row.graph_id;
  end if;

  return jsonb_build_object(
    'requestId', request_row.id,
    'storyId', request_row.story_id,
    'sourcePaths', to_jsonb(coalesce(source_paths, array[]::text[])),
    'publishedPaths', to_jsonb(coalesce(published_paths, array[]::text[]))
  );
end;
$$;

revoke all on function public.list_ai_video_story_requests(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_ai_video_story_publication(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_ai_video_story_publication(uuid, uuid, text[])
  from public, anon, authenticated;
revoke all on function public.delete_ai_video_story_request(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.list_ai_video_story_requests(uuid) to service_role;
grant execute on function public.prepare_ai_video_story_publication(uuid, uuid) to service_role;
grant execute on function public.finalize_ai_video_story_publication(uuid, uuid, text[]) to service_role;
grant execute on function public.delete_ai_video_story_request(uuid, uuid) to service_role;

comment on function public.prepare_ai_video_story_publication(uuid, uuid) is
  'Freezes a ready two-decision AI video graph into the existing private story publication lifecycle.';
comment on function public.delete_ai_video_story_request(uuid, uuid) is
  'Deletes an AI video story, its graph/jobs/publication records and returns exact Storage paths for service-role cleanup. Permanent character-name reservation is retained.';
