-- Phase 6: graph-aware publish + mobile delivery contract.
--
-- Publication is a three-stage protocol, not one atomic DB transaction
-- (Storage cannot participate in a Postgres transaction):
--   PREPARE  (this file, DB-only)  -- eligibility + frozen render snapshot
--            + deterministic publication_fingerprint -> a 'preparing' row
--   COPY     (admin-web, service-role Storage client) -- media-renders ->
--            published-story-media, exactly the frozen manifest's objects
--   FINALIZE (this file, DB-only)  -- verifies the copy, builds the
--            mobile-facing payload, flips status to 'published'
--
-- Visibility is entirely a function of status: mobile can only ever reach
-- FINALIZEd rows, both for the DB row (via the published_story_experiences
-- view) and for the copied Storage objects (via a Storage RLS policy keyed
-- off the same status column) -- object existence in the bucket alone is
-- never sufficient authorization.

-- ---------------------------------------------------------------------
-- Decision 5: extract the readiness-counting logic so publish preparation
-- and the existing admin-facing RPC share one implementation. External
-- signature/behavior of get_story_media_readiness is unchanged.
-- ---------------------------------------------------------------------
create or replace function private.compute_story_media_readiness(target_graph_id uuid)
returns table (
  total_clips integer, ready_clips integer, failed_clips integer, pending_clips integer,
  total_choice_audio integer, ready_choice_audio integer, failed_choice_audio integer,
  pending_choice_audio integer
)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*)::int from private.story_clips where graph_id = target_graph_id and kind <> 'decision'),
    (select count(*)::int from private.story_clips where graph_id = target_graph_id and kind <> 'decision' and status = 'ready'),
    (select count(*)::int from private.story_clips where graph_id = target_graph_id and kind <> 'decision' and status = 'failed'),
    (select count(*)::int from private.story_clips where graph_id = target_graph_id and kind <> 'decision' and status in ('pending', 'rendering')),
    (select count(*)::int from private.story_choice_media where graph_id = target_graph_id),
    (select count(*)::int from private.story_choice_media where graph_id = target_graph_id and status = 'ready'),
    (select count(*)::int from private.story_choice_media where graph_id = target_graph_id and status = 'failed'),
    (select count(*)::int from private.story_choice_media where graph_id = target_graph_id and status in ('pending', 'rendering'));
$$;

revoke all on function private.compute_story_media_readiness(uuid) from public, anon, authenticated;

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
  return query select * from private.compute_story_media_readiness(target_graph_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Publication lifecycle table (private -- same "full state stays private,
-- curated surface is public" convention as content_review_queue/
-- game_drafts). Never directly reachable by anon/authenticated.
-- ---------------------------------------------------------------------
create table private.story_publications (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  story_version integer not null check (story_version > 0),
  graph_id uuid not null references private.story_playback_graphs(id),
  -- Deterministic hash of the immutable publication inputs (see
  -- prepare_story_publication). Same snapshot always yields the same
  -- fingerprint; this is the DB-level concurrency/idempotency guarantee,
  -- not an application-level comparison.
  publication_fingerprint text not null,
  status text not null default 'preparing' check (status in ('preparing', 'published', 'failed')),
  -- Frozen at PREPARE time: [{kind, clipId|decisionClipId/audioRole/choiceId,
  -- renderId, sourcePath, durationMs, destPath}, ...]. Internal only --
  -- never exposed to mobile (contains renderId/sourcePath).
  media_manifest jsonb not null,
  -- The @adaptive/media-schema PublishedStoryExperience payload. Only
  -- present once status = 'published'.
  experience jsonb,
  published_version integer,
  prepared_by uuid not null references auth.users(id),
  prepared_at timestamptz not null default now(),
  published_at timestamptz,
  failed_reason text,
  unique (story_id, publication_fingerprint),
  unique (story_id, published_version),
  constraint story_publications_state_shape check (
    (status in ('preparing', 'failed') and published_version is null and experience is null and published_at is null)
    or (status = 'published' and published_version is not null and experience is not null and published_at is not null)
  )
);

create index story_publications_story_status_idx on private.story_publications (story_id, status);

revoke all on private.story_publications from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Mobile-facing surface: a view, not the table -- runs with the view
-- owner's privileges (Postgres's long-standing default view behavior), so
-- authenticated needs no grant at all on the private table underneath.
-- Column-projected (never media_manifest/graph_id/fingerprint/
-- prepared_by/failed_reason) and row-filtered to finalized publications
-- only, in one place -- not left to every future caller to remember a
-- WHERE clause.
-- ---------------------------------------------------------------------
create view public.published_story_experiences as
  select story_id, published_version, experience, published_at
  from private.story_publications
  where status = 'published';

revoke all on public.published_story_experiences from anon;
grant select on public.published_story_experiences to authenticated;

comment on view public.published_story_experiences is
  'Read-only, finalized video_branching publications. Payload shape is
   @adaptive/media-schema''s PublishedStoryExperience -- no storage_path,
   render_id, media_jobs, or provider internals. Backed by
   private.story_publications, which mobile can never query directly.';

-- ---------------------------------------------------------------------
-- Published media bucket + the storage-visibility correction: object
-- existence alone must never be sufficient authorization. Destination
-- paths are content-addressed under stories/{storyId}/{fingerprint}/... ,
-- so a SECURITY DEFINER function can correlate any object name back to a
-- *finalized* publication without granting authenticated direct access to
-- private.story_publications (same bridging pattern already used by
-- private.is_content_admin elsewhere in this project).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('published-story-media', 'published-story-media', false)
on conflict (id) do nothing;

create or replace function private.is_object_published(object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.story_publications sp
    where sp.status = 'published'
      and starts_with(object_name, 'stories/' || sp.story_id || '/' || sp.publication_fingerprint || '/')
  );
$$;

revoke all on function private.is_object_published(text) from public, anon;
grant execute on function private.is_object_published(text) to authenticated;

drop policy if exists "Authenticated can read finalized publication media" on storage.objects;
create policy "Authenticated can read finalized publication media"
on storage.objects for select
to authenticated
using (bucket_id = 'published-story-media' and private.is_object_published(name));

comment on function private.is_object_published(text) is
  'Storage RLS bridge: an object under published-story-media is only
   readable once a private.story_publications row with a matching
   story_id/fingerprint prefix has status = ''published''. An object
   physically existing there (copied during a still-preparing or later
   failed publication) is not, by itself, sufficient authorization.';

-- ---------------------------------------------------------------------
-- PREPARE
-- ---------------------------------------------------------------------
create or replace function public.prepare_story_publication(target_graph_id uuid, actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  graph private.story_playback_graphs%rowtype;
  decision_clip private.story_clips%rowtype;
  option_count integer;
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
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;

  select * into graph from private.story_playback_graphs where id = target_graph_id;
  if not found then raise exception 'graph % not found', target_graph_id; end if;

  if not exists (
    select 1 from public.published_story_versions
    where story_id = graph.story_id and story_version = graph.story_version
  ) then
    raise exception 'story % v% is not approved', graph.story_id, graph.story_version;
  end if;

  -- Re-verify the exactly-one-decision/exactly-two-options/valid-targets
  -- contract defensively, rather than trusting it was never violated since
  -- the graph was created.
  if (select count(*) from private.story_clips where graph_id = target_graph_id and kind = 'decision') <> 1 then
    raise exception 'graph % does not have exactly one decision clip', target_graph_id;
  end if;
  select * into decision_clip from private.story_clips where graph_id = target_graph_id and kind = 'decision';
  select jsonb_array_length(decision_clip.choice -> 'options') into option_count;
  if option_count <> 2 then
    raise exception 'decision clip % does not have exactly two options', decision_clip.id;
  end if;
  if exists (
    select 1 from jsonb_array_elements(decision_clip.choice -> 'options') opt
    where not exists (
      select 1 from private.story_clips target where target.graph_id = target_graph_id and target.id = opt ->> 'nextClipId'
    )
  ) then
    raise exception 'a decision option on % points to a missing clip', decision_clip.id;
  end if;

  select * into readiness from private.compute_story_media_readiness(target_graph_id);
  if readiness.total_clips = 0
     or readiness.ready_clips <> readiness.total_clips
     or readiness.failed_clips <> 0
     or readiness.pending_clips <> 0
     or readiness.ready_choice_audio <> readiness.total_choice_audio
     or readiness.failed_choice_audio <> 0
     or readiness.pending_choice_audio <> 0
  then
    raise exception 'graph % media is not fully ready', target_graph_id;
  end if;

  -- Raw render identities only (no destPath yet -- destPath is derived
  -- from the fingerprint, which is derived from these, so it cannot be
  -- computed before the fingerprint itself).
  select coalesce(jsonb_agg(jsonb_build_object(
      'clipId', c.id, 'renderId', c.render_id, 'sourcePath', c.storage_path
    ) order by c.id), '[]'::jsonb)
    into video_renders
    from private.story_clips c
    where c.graph_id = target_graph_id and c.kind <> 'decision';

  select coalesce(jsonb_agg(jsonb_build_object(
      'decisionClipId', m.decision_clip_id, 'audioRole', m.audio_role,
      'choiceId', m.choice_id, 'renderId', m.render_id, 'sourcePath', m.storage_path
    ) order by m.decision_clip_id, m.audio_role, coalesce(m.choice_id, '')), '[]'::jsonb)
    into audio_renders
    from private.story_choice_media m
    where m.graph_id = target_graph_id;

  -- Canonical fingerprint input, documented exhaustively: story identity +
  -- graph identity + every ready video clip's {clipId, renderId} + every
  -- ready decision-audio unit's {decisionClipId, audioRole, choiceId,
  -- renderId}, both collections sorted deterministically (order by above).
  -- Deliberately excludes: signed URLs (never exist yet), status,
  -- published_version, failed_reason, timestamps, sourcePath (redundant --
  -- a deterministic function of renderId under Phase 4's own path scheme).
  canonical := jsonb_build_object(
    'storyId', graph.story_id, 'storyVersion', graph.story_version, 'graphId', graph.id,
    'videoRenders', video_renders, 'audioRenders', audio_renders
  );
  -- extensions.digest: pgcrypto is enabled in the `extensions` schema
  -- (20260826222303_parent_child_profiles.sql), but this function runs
  -- with search_path = '' (project convention), so the call must be
  -- schema-qualified -- encode()/decode() are core Postgres, unaffected.
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');

  select * into existing from private.story_publications
    where story_id = graph.story_id and publication_fingerprint = fingerprint;
  -- Captured immediately: several more SELECT INTO statements run below
  -- (video_manifest/audio_manifest) before this result is used, and each
  -- one silently overwrites the ambient FOUND variable. Relying on FOUND
  -- itself after any intervening query is the bug to avoid here.
  existing_found := found;

  if existing_found and existing.status = 'published' then
    -- Identical snapshot already published -- idempotent short-circuit,
    -- nothing to copy.
    return jsonb_build_object(
      'publicationId', existing.id, 'status', existing.status,
      'fingerprint', existing.publication_fingerprint, 'copyManifest', '[]'::jsonb
    );
  end if;

  -- Now that the fingerprint is known, build the full manifest (adds
  -- destPath + durationMs) -- same underlying rows, re-queried.
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'video', 'clipId', c.id, 'renderId', c.render_id,
      'sourcePath', c.storage_path, 'durationMs', c.duration_ms,
      'destPath', 'stories/' || graph.story_id || '/' || fingerprint || '/clips/' || c.id || '.mp4'
    ) order by c.id), '[]'::jsonb)
    into video_manifest
    from private.story_clips c
    where c.graph_id = target_graph_id and c.kind <> 'decision';

  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'audio', 'decisionClipId', m.decision_clip_id, 'audioRole', m.audio_role,
      'choiceId', m.choice_id, 'renderId', m.render_id,
      'sourcePath', m.storage_path, 'durationMs', m.duration_ms,
      'destPath', 'stories/' || graph.story_id || '/' || fingerprint || '/audio/' || m.decision_clip_id ||
        '-' || m.audio_role || coalesce('-' || m.choice_id, '') || '.m4a'
    ) order by m.decision_clip_id, m.audio_role, coalesce(m.choice_id, '')), '[]'::jsonb)
    into audio_manifest
    from private.story_choice_media m
    where m.graph_id = target_graph_id;

  manifest := video_manifest || audio_manifest;

  if existing_found then
    -- Revive a failed attempt for this exact (unchanged) snapshot -- same
    -- row id, same fingerprint, same manifest. If the underlying render
    -- state had actually changed, the fingerprint computed above would
    -- differ and this branch would never be reached; a genuinely newer
    -- render selection always produces a brand new row, never a silent
    -- update to this one.
    update private.story_publications
      set status = 'preparing', failed_reason = null, prepared_by = actor_id, prepared_at = now()
      where id = existing.id
      returning id, status into result_id, result_status;
  else
    begin
      insert into private.story_publications
        (story_id, story_version, graph_id, publication_fingerprint, media_manifest, prepared_by)
      values (graph.story_id, graph.story_version, graph.id, fingerprint, manifest, actor_id)
      returning id, status into result_id, result_status;
    exception when unique_violation then
      -- Lost the race to a concurrent identical PREPARE call.
      select id, status into result_id, result_status
        from private.story_publications
        where story_id = graph.story_id and publication_fingerprint = fingerprint;
    end;
  end if;

  return jsonb_build_object(
    'publicationId', result_id, 'status', result_status,
    'fingerprint', fingerprint, 'copyManifest', manifest
  );
end;
$$;

-- ---------------------------------------------------------------------
-- FAIL -- only ever preparing -> failed. Never touches a published row.
-- ---------------------------------------------------------------------
create or replace function public.fail_story_publication(
  target_publication_id uuid, actor_id uuid, reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;

  update private.story_publications
    set status = 'failed', failed_reason = nullif(trim(reason), '')
    where id = target_publication_id and status = 'preparing';
  if not found then
    raise exception 'publication % is not in a preparing state', target_publication_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- FINALIZE
-- ---------------------------------------------------------------------
create or replace function public.finalize_story_publication(
  target_publication_id uuid, actor_id uuid, confirmed_object_paths text[]
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pub private.story_publications%rowtype;
  expected_paths text[];
  confirmed_sorted text[];
  story_row public.published_story_versions%rowtype;
  graph private.story_playback_graphs%rowtype;
  built_clips jsonb;
  experience_payload jsonb;
  next_version integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;

  select * into pub from private.story_publications where id = target_publication_id for update;
  if not found then raise exception 'publication % not found', target_publication_id; end if;

  if pub.status = 'published' then
    -- Retry-safe: finalize is a no-op once already published.
    return jsonb_build_object(
      'publicationId', pub.id, 'status', 'published',
      'publishedVersion', pub.published_version, 'publishedAt', pub.published_at,
      'experience', pub.experience
    );
  end if;
  if pub.status <> 'preparing' then
    raise exception 'publication % is not finalizable (status %)', target_publication_id, pub.status;
  end if;

  -- Set equality, not "all supplied paths exist": catches missing
  -- expected objects, unexpected extras, and substitution from another
  -- publication's objects all in one comparison.
  select array_agg(entry ->> 'destPath' order by entry ->> 'destPath')
    into expected_paths
    from jsonb_array_elements(pub.media_manifest) entry;
  select array_agg(p order by p) into confirmed_sorted from unnest(confirmed_object_paths) p;
  if confirmed_sorted is distinct from expected_paths then
    raise exception 'confirmed object paths do not match the prepared manifest for publication %', target_publication_id;
  end if;

  select * into story_row from public.published_story_versions
    where story_id = pub.story_id and story_version = pub.story_version;
  if not found then raise exception 'approved story % v% no longer available', pub.story_id, pub.story_version; end if;

  select * into graph from private.story_playback_graphs where id = pub.graph_id;

  select jsonb_agg(
    case c.kind
      when 'decision' then jsonb_build_object(
        'kind', 'decision', 'id', c.id,
        'question', jsonb_build_object(
          'text', c.choice ->> 'question',
          'audio', (
            select jsonb_build_object('mediaRef', entry ->> 'destPath', 'durationMs', (entry ->> 'durationMs')::int)
            from jsonb_array_elements(pub.media_manifest) entry
            where entry ->> 'kind' = 'audio' and entry ->> 'decisionClipId' = c.id and entry ->> 'audioRole' = 'question'
          )
        ),
        'options', (
          select jsonb_agg(jsonb_build_object(
            'id', opt ->> 'id', 'label', opt ->> 'label', 'nextClipId', opt ->> 'nextClipId',
            'audio', (
              select jsonb_build_object('mediaRef', entry ->> 'destPath', 'durationMs', (entry ->> 'durationMs')::int)
              from jsonb_array_elements(pub.media_manifest) entry
              where entry ->> 'kind' = 'audio' and entry ->> 'decisionClipId' = c.id
                and entry ->> 'audioRole' = 'choice' and entry ->> 'choiceId' = opt ->> 'id'
            )
          ) order by opt ->> 'id')
          from jsonb_array_elements(c.choice -> 'options') opt
        )
      )
      when 'linear' then jsonb_build_object(
        'kind', 'linear', 'id', c.id, 'nextClipId', c.next_clip_id,
        'video', (
          select jsonb_build_object('mediaRef', entry ->> 'destPath', 'durationMs', (entry ->> 'durationMs')::int)
          from jsonb_array_elements(pub.media_manifest) entry
          where entry ->> 'kind' = 'video' and entry ->> 'clipId' = c.id
        )
      )
      else jsonb_build_object(
        'kind', 'ending', 'id', c.id,
        'video', (
          select jsonb_build_object('mediaRef', entry ->> 'destPath', 'durationMs', (entry ->> 'durationMs')::int)
          from jsonb_array_elements(pub.media_manifest) entry
          where entry ->> 'kind' = 'video' and entry ->> 'clipId' = c.id
        )
      )
    end
    order by c.id
  ) into built_clips
  from private.story_clips c
  where c.graph_id = pub.graph_id;

  -- Version assignment is serialized per-story via an advisory lock, with
  -- unique(story_id, published_version) as a hard DB backstop -- two
  -- concurrent FINALIZE calls for different snapshots of the same story
  -- cannot both compute the same next_version.
  perform pg_advisory_xact_lock(hashtext(pub.story_id)::bigint);
  select coalesce(max(published_version), 0) + 1 into next_version
    from private.story_publications
    where story_id = pub.story_id and status = 'published';

  experience_payload := jsonb_build_object(
    'storyId', pub.story_id, 'storyVersion', pub.story_version,
    'publishedVersion', next_version,
    'experienceType', 'video_branching',
    'title', story_row.story ->> 'title',
    'greetingTemplate', story_row.story ->> 'greetingTemplate',
    'ageBands', story_row.story -> 'ageBands',
    'startClipId', graph.start_clip_id,
    'clips', built_clips,
    'publishedAt', to_jsonb(now())
  );

  update private.story_publications
    set status = 'published', published_version = next_version,
        experience = experience_payload, published_at = now()
    where id = target_publication_id;

  return jsonb_build_object(
    'publicationId', target_publication_id, 'status', 'published',
    'publishedVersion', next_version, 'publishedAt', now(), 'experience', experience_payload
  );
end;
$$;

revoke all on function public.prepare_story_publication(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_story_publication(uuid, uuid) to service_role;
revoke all on function public.fail_story_publication(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_story_publication(uuid, uuid, text) to service_role;
revoke all on function public.finalize_story_publication(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.finalize_story_publication(uuid, uuid, text[]) to service_role;

comment on table private.story_publications is
  'Phase 6 publication lifecycle: preparing -> published (terminal,
   immutable) or preparing -> failed -> preparing (Retry Publish, same
   fingerprint/manifest) -> published. published_version is assigned only
   at finalize, under a per-story advisory lock, backed by
   unique(story_id, published_version).';
