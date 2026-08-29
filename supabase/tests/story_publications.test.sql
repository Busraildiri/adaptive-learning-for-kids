begin;
select plan(38);

select has_table('private', 'story_publications', 'story_publications exists');
select has_view('public', 'published_story_experiences', 'published_story_experiences view exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('96000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', ''),
  ('96000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'family@example.test', '');
insert into private.content_admins(user_id) values ('96000000-0000-0000-0000-000000000001');

-- Approved story text: FINALIZE reads title/greetingTemplate/ageBands from
-- published_story_versions, never re-invents them.
insert into public.published_story_versions (story_id, story_version, content_version, story, source_request_id)
values ('pub-story', 1, '1.0.0',
  '{"id":"pub-story","version":1,"title":"Test Hikaye","greetingTemplate":"Merhaba!","ageBands":["2-4"],"experienceType":"video_branching"}'::jsonb,
  'pub-req-1');

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
create temporary table fixture_graph as
select public.create_story_playback_graph(
  'pub-story', 1, null, 'scene-01',
  $clips$[
    {"id": "scene-01", "kind": "linear", "sourceSceneId": "scene-01", "nextClipId": "help_01"},
    {"id": "help_01", "kind": "decision", "sourceSceneId": "help_01", "choice": {
      "question": "Nasıl yardım edelim?",
      "options": [
        {"id": "hug", "label": "Sarıl", "nextClipId": "help_01-hug"},
        {"id": "balloon", "label": "Balon bul", "nextClipId": "help_01-balloon"}
      ]
    }},
    {"id": "help_01-hug", "kind": "ending", "sourceSceneId": "help_01"},
    {"id": "help_01-balloon", "kind": "ending", "sourceSceneId": "help_01"}
  ]$clips$::jsonb
) as create_story_playback_graph;
grant select on fixture_graph to service_role;
reset role;

-- PREPARE refuses when nothing is rendered yet (media not ready).
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  format(
    $fmt$select public.prepare_story_publication(%L::uuid, '96000000-0000-0000-0000-000000000001'::uuid)$fmt$,
    (select create_story_playback_graph from fixture_graph)
  ),
  'P0001'
);
reset role;

-- Mark every clip ready with a distinct render_id/storage_path -- direct
-- state manipulation, the same technique used by
-- media_jobs_graph_extension.test.sql, standing in for the worker.
update private.story_clips set
  status = 'ready', storage_path = 'media-renders/pub-story/scene-01/r1.mp4',
  render_id = '10000000-0000-0000-0000-000000000001', duration_ms = 4000
where graph_id = (select create_story_playback_graph from fixture_graph) and id = 'scene-01';
update private.story_clips set
  status = 'ready', storage_path = 'media-renders/pub-story/help_01-hug/r2.mp4',
  render_id = '10000000-0000-0000-0000-000000000002', duration_ms = 4200
where graph_id = (select create_story_playback_graph from fixture_graph) and id = 'help_01-hug';
update private.story_clips set
  status = 'ready', storage_path = 'media-renders/pub-story/help_01-balloon/r3.mp4',
  render_id = '10000000-0000-0000-0000-000000000003', duration_ms = 4200
where graph_id = (select create_story_playback_graph from fixture_graph) and id = 'help_01-balloon';

-- Blocker-fix regression: create_story_playback_graph now pre-populates
-- the full required decision-audio inventory (question + both options) as
-- 'pending' rows immediately -- before any worker has touched anything.
-- A missing row no longer means "not required".
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select create_story_playback_graph from fixture_graph)),
  3::bigint, 'exactly 3 expected decision-audio rows exist immediately after graph creation'
);
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select create_story_playback_graph from fixture_graph) and status = 'pending'),
  3::bigint, 'all 3 start pending, before any rendering'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.update_choice_media_state(
  (select create_story_playback_graph from fixture_graph), 'help_01', 'question', null,
  'ready', 'media-renders/pub-story/help_01-question/r4.m4a', 1200);
select public.update_choice_media_state(
  (select create_story_playback_graph from fixture_graph), 'help_01', 'choice', 'hug',
  'ready', 'media-renders/pub-story/help_01-hug/r5.m4a', 900);
-- The third choice's pre-populated row is still sitting at 'pending' --
-- nothing further needs to happen to it for this to be a meaningful
-- "one still outstanding" case; no manual workaround insert required
-- anymore (this used to need one, before the blocker fix).
-- One choice still pending -- PREPARE must still refuse.
select throws_ok(
  format(
    $fmt$select public.prepare_story_publication(%L::uuid, '96000000-0000-0000-0000-000000000001'::uuid)$fmt$,
    (select create_story_playback_graph from fixture_graph)
  ),
  'P0001'
);
select public.update_choice_media_state(
  (select create_story_playback_graph from fixture_graph), 'help_01', 'choice', 'balloon',
  'ready', 'media-renders/pub-story/help_01-balloon/r6.m4a', 950);
reset role;

-- Unapproved story: same graph, different story_id, no published_story_versions row.
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
create temporary table unapproved_graph as
select public.create_story_playback_graph(
  'unapproved-story', 1, null, 'scene-01',
  $clips$[{"id": "scene-01", "kind": "ending", "sourceSceneId": "scene-01"}]$clips$::jsonb
) as create_story_playback_graph;
grant select on unapproved_graph to service_role;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  format(
    $fmt$select public.prepare_story_publication(%L::uuid, '96000000-0000-0000-0000-000000000001'::uuid)$fmt$,
    (select create_story_playback_graph from unapproved_graph)
  ),
  'P0001'
);
reset role;

-- Now fully ready + approved: PREPARE succeeds.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table prepared as
select public.prepare_story_publication(
  (select create_story_playback_graph from fixture_graph), '96000000-0000-0000-0000-000000000001'::uuid
) as result;
grant select on prepared to authenticated, service_role;
select is((select result->>'status' from prepared), 'preparing', 'first prepare enters preparing');
select ok((select jsonb_array_length(result->'copyManifest') from prepared) = 6, 'manifest has 3 video + 3 audio entries');
select ok(
  (select result->'copyManifest' from prepared)::text not like '%storage_path%'
  and (select result->'copyManifest' from prepared)::text not like '%media_jobs%',
  'manifest uses destPath/sourcePath keys, never a literal storage_path/media_jobs leak'
);

-- Fingerprint determinism: re-running PREPARE against the SAME unchanged
-- snapshot returns the identical publication id/fingerprint (idempotent
-- resume, and the closest single-connection proxy for "concurrent
-- identical prepare cannot create two rows").
create temporary table prepared_again as
select public.prepare_story_publication(
  (select create_story_playback_graph from fixture_graph), '96000000-0000-0000-0000-000000000001'::uuid
) as result;
select is(
  (select result->>'publicationId' from prepared_again),
  (select result->>'publicationId' from prepared),
  'same snapshot produces the same publication id on a second prepare'
);
select is(
  (select result->>'fingerprint' from prepared_again),
  (select result->>'fingerprint' from prepared),
  'same snapshot produces the same fingerprint'
);
reset role;

-- The DB uniqueness guarantee itself (not just app-level comparison):
-- inserting a second row with the same (story_id, fingerprint) is rejected
-- at the constraint level.
select throws_ok(
  format(
    $fmt$insert into private.story_publications
      (story_id, story_version, graph_id, publication_fingerprint, media_manifest, prepared_by)
      values ('pub-story', 1, %L::uuid, %L, '[]'::jsonb, '96000000-0000-0000-0000-000000000001'::uuid)
    $fmt$,
    (select create_story_playback_graph from fixture_graph),
    (select result->>'fingerprint' from prepared)
  ),
  '23505'
);

-- Changed render (simulating a Retry-fixed clip, now including a genuinely
-- different render_id per the blocker fix, not just a different path)
-- produces a DIFFERENT fingerprint -- content-sensitivity, not just
-- id-sensitivity.
update private.story_clips set
  storage_path = 'media-renders/pub-story/scene-01/r1-fixed.mp4',
  render_id = '10000000-0000-0000-0000-0000000000f1'
  where graph_id = (select create_story_playback_graph from fixture_graph) and id = 'scene-01';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table prepared_changed as
select public.prepare_story_publication(
  (select create_story_playback_graph from fixture_graph), '96000000-0000-0000-0000-000000000001'::uuid
) as result;
grant select on prepared_changed to authenticated, service_role;
select isnt(
  (select result->>'fingerprint' from prepared_changed),
  (select result->>'fingerprint' from prepared),
  'changing a selected render''s render_id/source path changes the fingerprint'
);
select isnt(
  (select result->>'publicationId' from prepared_changed),
  (select result->>'publicationId' from prepared),
  'a genuinely different snapshot gets its own publication row, not a silent overwrite'
);
reset role;
-- Deliberately NOT reverted: story_clips stays at the "-fixed" render for
-- the rest of this file. prepared's own experience payload was already
-- frozen at finalize time (below) and is unaffected by later story_clips
-- changes; the Retry Publish test at the end depends on this render state
-- still matching prepared_changed's fingerprint so PREPARE recomputes the
-- same fingerprint and revives the same (failed) row rather than
-- resolving to prepared's already-published one.

-- Simulate the COPY step (runs as service_role, which bypasses Storage
-- RLS entirely) having already placed the object -- physical existence in
-- the bucket, on its own, must not be enough for mobile to read it while
-- the owning publication is still 'preparing'.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into storage.objects (bucket_id, name)
values ('published-story-media', 'stories/pub-story/' || (select result->>'fingerprint' from prepared) || '/clips/scene-01.mp4');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::bigint from public.published_story_experiences where story_id = 'pub-story'),
  0::bigint, 'mobile sees nothing while the publication is preparing'
);
select throws_ok(
  $$select * from private.story_publications limit 1$$,
  '42501'
);
select is(
  (select count(*)::bigint from storage.objects
    where bucket_id = 'published-story-media'
      and name = 'stories/pub-story/' || (select result->>'fingerprint' from prepared) || '/clips/scene-01.mp4'),
  0::bigint, 'authenticated cannot SELECT a copied object while its publication is still preparing'
);
reset role;

-- FINALIZE rejects a wrong confirmed-paths set: missing, extra, and
-- substituted from another publication all count as a mismatch.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  format(
    $fmt$select public.finalize_story_publication(%L::uuid, '96000000-0000-0000-0000-000000000001'::uuid, array['stories/pub-story/only-one-path.mp4'])$fmt$,
    (select result->>'publicationId' from prepared)
  ),
  'P0001'
);

-- Correct finalize succeeds.
create temporary table finalized as
select public.finalize_story_publication(
  (select result->>'publicationId' from prepared)::uuid,
  '96000000-0000-0000-0000-000000000001'::uuid,
  (select array_agg(entry->>'destPath') from jsonb_array_elements((select result->'copyManifest' from prepared)) entry)
) as result;
select is((select result->>'status' from finalized), 'published', 'finalize succeeds with the exact manifest paths');
select is((select result->>'publishedVersion' from finalized), '1', 'first successful finalize is version 1');
reset role;

-- The DB-level backstop behind published_version assignment: two rows for
-- the same story cannot share a published_version even via a raw insert,
-- independent of the advisory-lock serialization inside finalize itself.
-- Runs under the privileged default role (like the fingerprint-uniqueness
-- check above it) -- service_role itself has no direct grant on
-- private.story_publications, only the SECURITY DEFINER RPCs do.
select throws_ok(
  $$insert into private.story_publications
      (story_id, story_version, graph_id, publication_fingerprint, status, media_manifest,
       published_version, experience, prepared_by, published_at)
    select 'pub-story', 1, graph_id, 'a-second-fake-fingerprint', 'published', '[]'::jsonb,
      1, '{}'::jsonb, prepared_by, now()
    from private.story_publications where story_id = 'pub-story' and status = 'published' limit 1$$,
  '23505'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- Finalize is retry-safe: calling it again with the same (now-published)
-- publication id returns the same result without erroring.
create temporary table finalized_again as
select public.finalize_story_publication(
  (select result->>'publicationId' from prepared)::uuid,
  '96000000-0000-0000-0000-000000000001'::uuid,
  (select array_agg(entry->>'destPath') from jsonb_array_elements((select result->'copyManifest' from prepared)) entry)
) as result;
select is(
  (select result->>'publishedVersion' from finalized_again),
  (select result->>'publishedVersion' from finalized),
  'finalize on an already-published row is idempotent, not a new version'
);
reset role;

-- Now mobile can see it, and only the projected, safe columns.
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::bigint from public.published_story_experiences where story_id = 'pub-story'),
  1::bigint, 'mobile sees exactly one finalized publication'
);
select is(
  (select (experience->>'publishedVersion')::int from public.published_story_experiences where story_id = 'pub-story'),
  1, 'mobile-visible payload carries the published version'
);
select ok(
  (select experience::text from public.published_story_experiences where story_id = 'pub-story') not like '%storage_path%'
  and (select experience::text from public.published_story_experiences where story_id = 'pub-story') not like '%render_id%'
  and (select experience::text from public.published_story_experiences where story_id = 'pub-story') not like '%media-renders%'
  and (select experience::text from public.published_story_experiences where story_id = 'pub-story') not like '%signedUrl%',
  'published payload contains no storage_path/render_id/media-renders/signed-url leakage'
);
select is(
  (select experience->>'title' from public.published_story_experiences where story_id = 'pub-story'),
  'Test Hikaye', 'published payload carries the approved story title'
);

-- Topology preservation: the decision clip's two options still point at
-- their original nextClipId targets, and both targets exist in the
-- published clips array (id-based navigation, unchanged from the source
-- StoryPlaybackGraph).
select is(
  (select clip->'question'->>'text' from public.published_story_experiences,
     jsonb_array_elements(experience->'clips') clip where story_id='pub-story' and clip->>'kind'='decision'),
  'Nasıl yardım edelim?', 'decision question text preserved'
);
select ok(
  (select jsonb_agg(opt->>'nextClipId')
   from (
     select clip from public.published_story_experiences,
       jsonb_array_elements(experience->'clips') clip
       where story_id = 'pub-story' and clip->>'kind' = 'decision'
   ) decision_clip,
   jsonb_array_elements(decision_clip.clip->'options') opt
  ) @> '["help_01-hug", "help_01-balloon"]'::jsonb,
  'both decision options still target their original source-graph clip ids'
);
select ok(
  (select jsonb_agg(c->>'id') from public.published_story_experiences,
    jsonb_array_elements(experience->'clips') c where story_id='pub-story')
    @> '["scene-01", "help_01", "help_01-hug", "help_01-balloon"]'::jsonb,
  'every source clip id is present in the published clips array'
);

-- Now that it is finalized, mobile CAN read the objects the manifest names.
select ok(
  (select count(*)::bigint from storage.objects
    where bucket_id = 'published-story-media'
      and name = 'stories/pub-story/' || (select result->>'fingerprint' from prepared) || '/clips/scene-01.mp4') = 1,
  'authenticated can SELECT the exact object after finalize'
);
reset role;

-- A guessed/unpublished fingerprint path is denied even though a real
-- object physically exists at it -- object existence alone is never
-- sufficient authorization.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into storage.objects (bucket_id, name)
values ('published-story-media', 'stories/pub-story/guessed-unpublished-fingerprint/clips/scene-01.mp4');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::bigint from storage.objects where bucket_id = 'published-story-media'
    and name = 'stories/pub-story/guessed-unpublished-fingerprint/clips/scene-01.mp4'),
  0::bigint, 'a guessed/mismatched fingerprint path is not readable even though the object exists'
);
reset role;

-- published -> preparing is impossible; failed publications never appear
-- to mobile either.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  format(
    $fmt$select public.fail_story_publication(%L::uuid, '96000000-0000-0000-0000-000000000001'::uuid, 'boom')$fmt$,
    (select result->>'publicationId' from prepared)
  ),
  'P0001'
);

-- A brand new snapshot (the "changed render" one from earlier) can be
-- failed, then Retry Publish revives the SAME row/fingerprint/manifest --
-- it must not silently pick up a newer render.
select public.fail_story_publication(
  (select result->>'publicationId' from prepared_changed)::uuid,
  '96000000-0000-0000-0000-000000000001'::uuid, 'copy timed out'
);
-- Simulate a partial COPY that ran before the failure was recorded: an
-- object under the FAILED publication's own fingerprint prefix.
insert into storage.objects (bucket_id, name)
values ('published-story-media', 'stories/pub-story/' || (select result->>'fingerprint' from prepared_changed) || '/clips/scene-01.mp4');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::bigint from public.published_story_experiences
    where story_id = 'pub-story' and published_at is not null
      and (experience->>'publishedVersion')::int > 1),
  0::bigint, 'a failed publication never becomes mobile-visible'
);
select is(
  (select count(*)::bigint from storage.objects
    where bucket_id = 'published-story-media'
      and name = 'stories/pub-story/' || (select result->>'fingerprint' from prepared_changed) || '/clips/scene-01.mp4'),
  0::bigint, 'authenticated cannot SELECT an object belonging to a failed publication either'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table revived as
select public.prepare_story_publication(
  (select create_story_playback_graph from fixture_graph), '96000000-0000-0000-0000-000000000001'::uuid
) as result;
select is(
  (select result->>'publicationId' from revived),
  (select result->>'publicationId' from prepared_changed),
  'Retry Publish (failed -> preparing) reuses the same publication id/fingerprint, not a new snapshot'
);
select is((select result->>'status' from revived), 'preparing', 'revived publication returns to preparing');
reset role;

select is((select count(*) from private.story_publications), 2::bigint, 'exactly two distinct snapshots were ever prepared for this story');

select * from finish();
rollback;
