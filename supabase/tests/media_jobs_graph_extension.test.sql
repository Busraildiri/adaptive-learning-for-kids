begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('95000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', ''),
  ('95000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parent@example.test', '');
insert into private.content_admins(user_id) values ('95000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);

create temporary table created_graph as
select public.create_story_playback_graph(
  'mirmir-story', 1, null, 'scene-01',
  $clips$[
    {"id": "scene-01", "kind": "linear", "sourceSceneId": "scene-01", "nextClipId": "help_01"},
    {"id": "help_01", "kind": "decision", "sourceSceneId": "help_01", "choice": {
      "question": "Nasıl yardım etmek istersin?",
      "options": [
        {"id": "hug", "label": "Sarıl", "nextClipId": "help_01-hug"},
        {"id": "balloon", "label": "Balon bul", "nextClipId": "help_01-balloon"}
      ]
    }},
    {"id": "help_01-hug", "kind": "ending", "sourceSceneId": "help_01"},
    {"id": "help_01-balloon", "kind": "ending", "sourceSceneId": "help_01"}
  ]$clips$::jsonb
) as create_story_playback_graph;

-- Server-side relationship validation. Messages are interpolated (contain a
-- real uuid), so these use the 2-arg (any-exception) throws_ok form rather
-- than trying to match exact text.
-- P0001 = the generic SQLSTATE for a plain `raise exception`. The message
-- itself is interpolated (contains a real uuid/clip id) so it can't be
-- matched exactly -- P0001 confirms "an exception was raised" without
-- over-fitting to exact text.
select throws_ok(
  format(
    $fmt$select public.create_media_job('mirmir-story', 'nonexistent-clip', 'openmontage',
      'local_animation', '{}'::jsonb, %L::uuid, 'video')$fmt$,
    (select create_story_playback_graph from created_graph)
  ),
  'P0001'
);
select throws_ok(
  format(
    $fmt$select public.create_media_job('mirmir-story', 'help_01', 'openmontage',
      'local_animation', '{}'::jsonb, %L::uuid, 'audio', 'choice', 'not-a-real-choice')$fmt$,
    (select create_story_playback_graph from created_graph)
  ),
  'P0001'
);

select is(
  (select total_clips from public.get_story_media_readiness(
    (select create_story_playback_graph from created_graph))),
  3, 'readiness counts the three non-decision clips'
);

-- Duplicate enqueue: two identical requests while the first is still active
-- return the SAME job id, not two rows.
create temporary table first_job as
select public.create_media_job(
  'mirmir-story', 'scene-01', 'openmontage', 'local_animation', '{"scene":{}}'::jsonb,
  (select create_story_playback_graph from created_graph), 'video'
) as create_media_job;
-- Read later under service_role -- temp tables don't auto-grant across a
-- role switch within the same session, same lesson as private schema access.
grant select on first_job to service_role;
create temporary table second_job as
select public.create_media_job(
  'mirmir-story', 'scene-01', 'openmontage', 'local_animation', '{"scene":{}}'::jsonb,
  (select create_story_playback_graph from created_graph), 'video'
) as create_media_job;
select is(
  (select create_media_job from first_job), (select create_media_job from second_job),
  'duplicate enqueue for the same active identity returns the existing job'
);
select is(
  (select count(*)::bigint from public.list_media_jobs()
    where scene_id = 'scene-01' and media_kind = 'video'),
  1::bigint, 'only one row was actually inserted'
);
reset role;

-- Once a job leaves the active set, a new request for the same identity is
-- NOT deduplicated -- dedup only blocks active duplicates, never legitimate
-- re-creation after completion.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  format(
    $fmt$select public.update_media_job_status(%L::uuid, 'ready', 100)$fmt$,
    (select create_media_job from first_job)
  ),
  'admin marks the first job ready'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);
create temporary table third_job as
select public.create_media_job(
  'mirmir-story', 'scene-01', 'openmontage', 'local_animation', '{"scene":{}}'::jsonb,
  (select create_story_playback_graph from created_graph), 'video'
) as create_media_job;
select isnt(
  (select create_media_job from third_job), (select create_media_job from first_job),
  'a fresh job for the same identity is created once the prior one is no longer active'
);
reset role;

-- claim_next_media_job assigns render_id and the honest 'rendering' status.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temporary table claimed as select * from public.claim_next_media_job();
grant select on claimed to authenticated;
select is((select status from claimed), 'rendering', 'claim sets the honest rendering status');
select ok((select render_id from claimed) is not null, 'claim assigns a fencing render_id');

select throws_ok(
  $$select public.update_media_job_status(
    (select id from claimed), 'ready', 100, null, null, null, gen_random_uuid())$$,
  'P0001'
);
select lives_ok(
  format(
    $fmt$select public.update_media_job_status(%L::uuid, 'ready', 100, null, null, null, %L::uuid)$fmt$,
    (select id from claimed), (select render_id from claimed)
  ),
  'matching render_id is accepted'
);
reset role;

-- retry_media_job: only a failed job can be retried; clears render_id.
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format($fmt$select public.retry_media_job(%L::uuid)$fmt$, (select id from claimed)),
  'no failed job with that id (already retried or not failed)',
  'a ready job cannot be retried'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  format(
    $fmt$select public.update_media_job_status(%L::uuid, 'failed', null, null, 'boom', null, %L::uuid)$fmt$,
    (select id from claimed), (select render_id from claimed)
  ),
  'job marked failed for the retry test'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);
select lives_ok(
  format($fmt$select public.retry_media_job(%L::uuid)$fmt$, (select id from claimed)),
  'a failed job can be retried'
);
select is(
  (select status from public.get_media_job((select id from claimed))), 'queued',
  'retry resets status to queued'
);
reset role;

-- requeue_stale_media_jobs: service_role only, requires an explicit cutoff,
-- requeues only rows past it, no hard-coded timeout.
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);
-- 42501 (insufficient_privilege): authenticated has no EXECUTE grant at
-- all on this function, so Postgres rejects it before this RPC's own
-- `auth.role()` check ever runs -- an even earlier line of defense.
select throws_ok(
  $$select public.requeue_stale_media_jobs(interval '10 minutes')$$,
  '42501'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  $$select public.requeue_stale_media_jobs(null)$$,
  'cutoff_interval is required', 'no hard-coded default cutoff exists'
);
reset role;

update private.media_jobs set status = 'rendering', updated_at = now() - interval '2 hours'
where id = (select id from claimed);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.requeue_stale_media_jobs(interval '30 minutes'), 1,
  'a job stuck in rendering past the cutoff is requeued'
);
reset role;

select is(
  (select status from private.media_jobs where id = (select id from claimed)), 'queued',
  'stale job was reset to queued'
);
select is(
  (select render_id from private.media_jobs where id = (select id from claimed)), null,
  'stale requeue clears render_id so a late update from the old attempt is fenced out'
);

select * from finish();
rollback;
