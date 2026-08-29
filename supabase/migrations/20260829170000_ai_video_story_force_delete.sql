-- Adds an explicit force option to delete_ai_video_story_request. The
-- "cannot delete while rendering" guard is correct by default (avoids
-- deleting out from under a live worker), but it can't distinguish "a
-- worker is actively processing this" from "the worker process was
-- stopped and these job rows are permanently stuck" -- both look
-- identical in media_jobs.status. force=true is an explicit, deliberate
-- admin override for the latter case, never the default.

create or replace function public.delete_ai_video_story_request(
  target_request_id uuid, target_actor_id uuid, force boolean default false
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
  if not force and exists (
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

revoke all on function public.delete_ai_video_story_request(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.delete_ai_video_story_request(uuid, uuid, boolean) to service_role;

comment on function public.delete_ai_video_story_request(uuid, uuid, boolean) is
  'Deletes an AI video story, its graph/jobs/publication records and returns exact Storage paths for service-role cleanup. force=true bypasses the "still rendering" guard for jobs stuck by a stopped worker -- an explicit admin override, never the default. Permanent character-name reservation is retained.';
