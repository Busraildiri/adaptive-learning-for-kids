-- Phase 6 blocker fix regression: the full required decision-audio
-- inventory must exist (as 'pending') the moment a graph is created, and
-- render_id must actually be persisted when a job completes.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values ('97000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', '');
insert into private.content_admins(user_id) values ('97000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000001', true);
create temporary table inv_graph as
select public.create_story_playback_graph(
  'inventory-story', 1, null, 'scene-01',
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
) as id;
grant select on inv_graph to service_role;
reset role;

-- Requirements 1-3: immediately after graph creation, before any worker
-- has run, the full expected inventory already exists as 'pending'.
select is(
  (select count(*)::bigint from private.story_choice_media where graph_id = (select id from inv_graph)),
  3::bigint, 'exactly 3 expected decision-audio rows exist immediately after graph creation'
);
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'question'),
  1::bigint, 'exactly one question row'
);
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'choice'),
  2::bigint, 'exactly one row per choice option'
);
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select id from inv_graph) and status = 'pending'),
  3::bigint, 'all 3 start pending'
);
select is(
  (select count(*)::bigint from private.story_choice_media
    where graph_id = (select id from inv_graph) and status = 'ready'),
  0::bigint, 'zero are ready before any rendering'
);

-- The graph's own choice.options is the source of truth, not a hardcoded
-- "3": the two option rows carry the exact choice ids from the graph.
select ok(
  (select jsonb_agg(choice_id) from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'choice') @> '["hug", "balloon"]'::jsonb,
  'option rows carry the exact choice ids from the graph, not invented ones'
);

-- Readiness (via the admin-facing RPC) reflects this directly.
select is((select total_choice_audio from public.get_story_media_readiness((select id from inv_graph))), 3, 'readiness sees 3 required audio units before any rendering');
select is((select pending_choice_audio from public.get_story_media_readiness((select id from inv_graph))), 3, 'readiness counts all 3 as pending before rendering');
select is((select ready_choice_audio from public.get_story_media_readiness((select id from inv_graph))), 0, 'readiness counts zero as ready before rendering');

-- Requirement 10: unique identity semantics are unchanged and still
-- enforced -- the pre-population insert uses the exact same identity
-- shape the upsert's own conflict target relies on.
select throws_ok(
  format(
    $fmt$insert into private.story_choice_media (graph_id, decision_clip_id, audio_role, choice_id)
      values (%L::uuid, 'help_01', 'question', null)$fmt$,
    (select id from inv_graph)
  ),
  '23505'
);

-- Requirements 8, 11: a worker completing a job updates the PRE-EXISTING
-- row in place (not a new insert) and persists the render_id that
-- actually belongs to that render attempt. Only the RPC calls themselves
-- run as service_role -- direct SELECTs against private.* must run under
-- the privileged default role, same as everywhere else in this suite;
-- service_role has no direct grant on private schema tables, only the
-- SECURITY DEFINER RPCs do.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.update_choice_media_state(
  (select id from inv_graph), 'help_01', 'question', null,
  'ready', 'media-renders/inventory-story/help_01-question/r1.m4a', 1000, null,
  '20000000-0000-0000-0000-000000000001'::uuid
);
reset role;
select is(
  (select count(*)::bigint from private.story_choice_media where graph_id = (select id from inv_graph)),
  3::bigint, 'completing a job updates the existing row -- row count does not grow'
);
select is(
  (select status from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'question'),
  'ready', 'the pre-existing question row transitions to ready'
);
select is(
  (select render_id from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'question'),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'render_id is persisted on the choice-audio row'
);

-- Requirement 9: Retry Render (a second completion with a different
-- render_id) still does not create a duplicate row.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.update_choice_media_state(
  (select id from inv_graph), 'help_01', 'question', null,
  'ready', 'media-renders/inventory-story/help_01-question/r1-retry.m4a', 1050, null,
  '20000000-0000-0000-0000-000000000002'::uuid
);
reset role;
select is(
  (select count(*)::bigint from private.story_choice_media where graph_id = (select id from inv_graph)),
  3::bigint, 'retrying does not create a duplicate story_choice_media row'
);
select is(
  (select render_id from private.story_choice_media
    where graph_id = (select id from inv_graph) and audio_role = 'question'),
  '20000000-0000-0000-0000-000000000002'::uuid,
  'render_id reflects the latest successful render after a retry'
);

-- render_id persistence on the video side too (story_clips).
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.update_story_clip_media_state(
  (select id from inv_graph), 'scene-01', 'ready',
  'media-renders/inventory-story/scene-01/r1.mp4', 4000, null,
  '20000000-0000-0000-0000-000000000003'::uuid
);
reset role;
select is(
  (select render_id from private.story_clips where graph_id = (select id from inv_graph) and id = 'scene-01'),
  '20000000-0000-0000-0000-000000000003'::uuid,
  'render_id is persisted on the video clip row too'
);

select * from finish();
rollback;
