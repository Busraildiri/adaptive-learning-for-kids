-- Playback topology (story_playback_graphs/story_clips) is stored separately
-- from any content-schema table: it is DERIVED from a Story, never a source
-- of narrative/pedagogical truth itself. source_request_id is provenance
-- only -- deliberately not unique, so a story/story_version can be
-- regenerated into a new graph without constraint conflicts.
create table private.story_playback_graphs (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  story_version integer not null check (story_version > 0),
  source_request_id text references private.content_generation_runs(request_id),
  start_clip_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index story_playback_graphs_story_idx
  on private.story_playback_graphs (story_id, story_version);

-- Topology fields (kind/source_scene_id/role/next_clip_id/choice) and render
-- lifecycle fields (status/video_url/duration_ms/error) are both columns on
-- this one row for storage convenience, but that is a persistence detail --
-- the TS/Python domain models keep them as two separate types (PlaybackClip
-- vs ClipMediaState) and get_story_playback_graph() below returns them
-- nested separately (`clip` / `media`), not flattened.
create table private.story_clips (
  graph_id uuid not null references private.story_playback_graphs(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('linear', 'decision', 'ending')),
  source_scene_id text not null,
  role text,
  next_clip_id text,
  choice jsonb,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'ready', 'failed')),
  video_url text,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (graph_id, id),
  constraint story_clips_kind_shape check (
    (kind = 'linear' and next_clip_id is not null and choice is null)
    or (kind = 'decision' and next_clip_id is null and choice is not null)
    or (kind = 'ending' and next_clip_id is null and choice is null)
  )
);

create index story_clips_pending_idx
  on private.story_clips (status)
  where status in ('pending', 'rendering');

revoke all on private.story_playback_graphs from public, anon, authenticated;
revoke all on private.story_clips from public, anon, authenticated;

-- Phase 1 scope: create + read only. Per-clip media-state updates (the
-- worker writing status/video_url as jobs complete) are Phase 3/4 work and
-- deliberately not added yet.
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
  end loop;

  return new_graph_id;
end;
$$;

create or replace function public.get_story_playback_graph(target_graph_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'id', g.id,
    'storyId', g.story_id,
    'storyVersion', g.story_version,
    'sourceRequestId', g.source_request_id,
    'startClipId', g.start_clip_id,
    'clips', coalesce(clips.items, '[]'::jsonb)
  ))
  into result
  from private.story_playback_graphs g
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'clip', jsonb_strip_nulls(jsonb_build_object(
          'id', c.id,
          'kind', c.kind,
          'sourceSceneId', c.source_scene_id,
          'role', c.role,
          'nextClipId', c.next_clip_id,
          'choice', c.choice
        )),
        'media', jsonb_strip_nulls(jsonb_build_object(
          'clipId', c.id,
          'status', c.status,
          'videoUrl', c.video_url,
          'durationMs', c.duration_ms,
          'error', c.error
        ))
      )
      order by c.id
    ) as items
    from private.story_clips c
    where c.graph_id = g.id
  ) clips on true
  where g.id = target_graph_id;

  if result is null then raise exception 'playback graph not found'; end if;
  return result;
end;
$$;

grant execute on function public.create_story_playback_graph(text, integer, text, text, jsonb)
  to authenticated;
grant execute on function public.get_story_playback_graph(uuid) to authenticated;

comment on table private.story_playback_graphs is
  'Playback topology derived from a Story, not a source of narrative truth.
   Mirrors packages/media-schema StoryPlaybackGraph. source_request_id is
   provenance only (references content_generation_runs, not unique) so a
   story/story_version can be regenerated into a new graph freely.';
comment on table private.story_clips is
  'One row per PlaybackClip. Topology columns (kind/source_scene_id/role/
   next_clip_id/choice) and render-lifecycle columns (status/video_url/
   duration_ms/error) are separate concepts at the domain-model level
   (PlaybackClip vs ClipMediaState in packages/media-schema) even though
   they are colocated here for storage simplicity.';
