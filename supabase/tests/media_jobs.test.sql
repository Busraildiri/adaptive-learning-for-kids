begin;
select plan(16);

select has_table('private', 'media_jobs', 'media jobs table exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', ''),
  ('92000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parent@example.test', '');
insert into private.content_admins(user_id) values ('92000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.create_media_job('story_001', 'trigger_01', 'openmontage', 'local_animation', '{"sceneId":"trigger_01"}'::jsonb)$$,
  'content admin required', 'parent cannot create a media job'
);
select throws_ok($$select * from public.list_media_jobs()$$, 'content admin required', 'parent cannot list media jobs');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.create_media_job('story_001', 'trigger_01', 'openmontage', 'cloud_hd', '{"sceneId":"trigger_01"}'::jsonb)$$,
  'invalid mode', 'unknown mode is rejected'
);
select lives_ok(
  $$select public.create_media_job('story_001', 'trigger_01', 'openmontage', 'local_animation',
    '{"sceneId":"trigger_01","storyId":"story_001","narration":"test","emotion":"neutral","duration":5}'::jsonb)$$,
  'admin creates a media job'
);
select results_eq($$select count(*)::bigint from public.list_media_jobs()$$, $$values (1::bigint)$$, 'admin lists own job');
select is((select status from public.list_media_jobs() limit 1), 'queued', 'new job starts queued');
select is((select progress from public.list_media_jobs() limit 1), 0, 'new job starts at 0 progress');
select is(
  (select render_manifest ->> 'narration' from public.list_media_jobs() limit 1),
  'test', 'render manifest round-trips through create/list'
);
reset role;

select throws_ok(
  $$select public.claim_next_media_job()$$, 'service role required', 'browser cannot claim jobs'
);
select throws_ok(
  $$select public.update_media_job_status((select id from private.media_jobs limit 1), 'rendering')$$,
  'service role required', 'browser cannot update job status'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
-- service_role has no direct SELECT on the `private` schema (by design --
-- only the SECURITY DEFINER RPCs may touch it), so the claimed job is
-- captured from claim_next_media_job()'s own return value into a temp
-- table instead of querying private.media_jobs directly.
create temporary table claimed_job as select * from public.claim_next_media_job();
-- Phase 4 made claim_next_media_job()'s honest status set queued ->
-- rendering -> uploading -> ready/failed (the old 'generating_audio' etc.
-- intermediate values were never actually driven by real instrumentation).
select is((select status from claimed_job), 'rendering', 'worker claims and advances the job');
select is((select count(*) from public.claim_next_media_job()), 0::bigint, 'nothing left to claim once taken');
select lives_ok(
  format(
    $fmt$select public.update_media_job_status(%L::uuid, 'ready', 100, 'https://example.test/final.mp4')$fmt$,
    (select id from claimed_job)
  ),
  'worker marks job ready with an asset url'
);
reset role;

select is((select status from private.media_jobs limit 1), 'ready', 'job status persisted as ready');
select is((select asset_url from private.media_jobs limit 1), 'https://example.test/final.mp4', 'asset url persisted');

select * from finish();
rollback;
