begin;
select plan(11);

select has_table('private', 'story_playback_graphs', 'playback graphs table exists');
select has_table('private', 'story_clips', 'story clips table exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('93000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', ''),
  ('93000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parent@example.test', '');
insert into private.content_admins(user_id) values ('93000000-0000-0000-0000-000000000001');

insert into private.content_generation_runs
(request_id, story_id, status, generator_model, supervisor_model, prompt_hash, schema_version,
 safety_rules_version, guidance_version, generated_story, generated_story_version)
values
('mirmir-req-1', 'mirmir-story', 'draft', 'g', 'r', 'h1', 's', 'safe', 'guide', '{"id":"mirmir-story"}', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.create_story_playback_graph('mirmir-story', 1, 'mirmir-req-1', 'scene-01', '[]'::jsonb)$$,
  'content admin required', 'parent cannot create a playback graph'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000001', true);

create temporary table created_graph as
select public.create_story_playback_graph(
  'mirmir-story', 1, 'mirmir-req-1', 'scene-01',
  $clips$[
    {"id": "scene-01", "kind": "linear", "sourceSceneId": "scene-01", "nextClipId": "scene-02"},
    {"id": "scene-02", "kind": "decision", "sourceSceneId": "scene-02", "choice": {
      "question": "Mırmır'a nasıl yardım etmek istersin?",
      "options": [
        {"id": "hug", "label": "Sarıl", "nextClipId": "scene-03-hug"},
        {"id": "balloon", "label": "Balon bul", "nextClipId": "scene-03-balloon"}
      ]
    }},
    {"id": "scene-03-hug", "kind": "ending", "sourceSceneId": "scene-03"},
    {"id": "scene-03-balloon", "kind": "ending", "sourceSceneId": "scene-03"}
  ]$clips$::jsonb
) as create_story_playback_graph;

select ok((select create_story_playback_graph from created_graph) is not null, 'admin creates a playback graph');
-- Clip count is checked below via get_story_playback_graph() rather than a
-- direct `private.story_clips` count: authenticated has no SELECT on
-- `private` (by design, same as media_jobs) -- only the RPCs read it.

select is(
  (select (public.get_story_playback_graph(g.create_story_playback_graph) ->> 'startClipId')
   from created_graph g),
  'scene-01', 'get_story_playback_graph returns the start clip id'
);
select is(
  (select jsonb_array_length(public.get_story_playback_graph(g.create_story_playback_graph) -> 'clips')
   from created_graph g),
  4, 'get_story_playback_graph returns all clips'
);
select is(
  (select clip -> 'clip' ->> 'kind'
   from created_graph g,
     jsonb_array_elements(public.get_story_playback_graph(g.create_story_playback_graph) -> 'clips') clip
   where clip -> 'clip' ->> 'id' = 'scene-02'),
  'decision', 'clip topology is nested under "clip"'
);
select is(
  (select clip -> 'media' ->> 'status'
   from created_graph g,
     jsonb_array_elements(public.get_story_playback_graph(g.create_story_playback_graph) -> 'clips') clip
   where clip -> 'clip' ->> 'id' = 'scene-01'),
  'pending', 'render state is nested under "media", separate from topology'
);

-- Regeneration: a second graph for the same story/version must not be blocked.
select lives_ok(
  $$select public.create_story_playback_graph('mirmir-story', 1, 'mirmir-req-1', 'scene-01',
    '[{"id":"scene-01","kind":"ending","sourceSceneId":"scene-01"}]'::jsonb)$$,
  'a second graph for the same story/version is allowed (regeneration)'
);
reset role;

-- story_clips_kind_shape CHECK: a decision-kind row without a choice must be
-- rejected. Matched by SQLSTATE only (23514 = check_violation): pgTAP's
-- 3-arg throws_ok(sql, code, description) turned out to still compare the
-- 3rd arg against the actual message text, not just label the test -- so a
-- custom description isn't safely combinable with code-only matching here.
-- 2-arg form checks only the code and lets pgTAP auto-generate the label.
select throws_ok(
  $$insert into private.story_clips (graph_id, id, kind, source_scene_id)
    select create_story_playback_graph, 'bad-clip', 'decision', 'x' from created_graph$$,
  '23514'
);

-- request.jwt.claim.sub survives `reset role` (it is a GUC, not the role) --
-- clear it explicitly so this call is genuinely unauthenticated.
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_story_playback_graph((select create_story_playback_graph from created_graph))$$,
  'content admin required', 'unauthenticated caller cannot read a playback graph'
);

select * from finish();
rollback;
