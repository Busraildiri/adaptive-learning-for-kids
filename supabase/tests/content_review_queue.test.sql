begin;
select plan(25);

select has_table('private', 'content_admins', 'content admins exists');
select has_table('private', 'content_review_queue', 'review queue exists');
select has_table('private', 'content_review_decisions', 'decision audit exists');
select has_table('public', 'published_story_versions', 'published stories exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', ''),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parent@example.test', '');
insert into private.content_admins(user_id) values ('90000000-0000-0000-0000-000000000001');

insert into private.content_generation_runs
(request_id, story_id, status, generator_model, supervisor_model, prompt_hash, schema_version,
 safety_rules_version, guidance_version, generated_story, generated_story_version)
values
('r9-approve', 'story-a', 'draft', 'g', 'r', 'h1', 's', 'safe', 'guide', '{"id":"story-a"}', 2),
('r9-reject', 'story-b', 'draft', 'g', 'r', 'h2', 's', 'safe', 'guide', '{"id":"story-b"}', 2),
('r9-expire', 'story-c', 'draft', 'g', 'r', 'h3', 's', 'safe', 'guide', '{"id":"story-c"}', 2);

insert into private.content_review_queue
(id, request_id, story_id, story_version, content_version, suspicion_reasons, story, queued_at, expires_at)
values
('91000000-0000-0000-0000-000000000001', 'r9-approve', 'story-a', 2, '1.1.0', '["reviewer_disagreement"]', '{"id":"story-a"}', now(), now() + interval '15 days'),
('91000000-0000-0000-0000-000000000002', 'r9-reject', 'story-b', 2, '1.1.0', '["borderline_language"]', '{"id":"story-b"}', now(), now() + interval '15 days'),
('91000000-0000-0000-0000-000000000003', 'r9-expire', 'story-c', 2, '1.1.0', '["low_confidence"]', '{"id":"story-c"}', now() - interval '16 days', now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
select is(public.is_content_admin(), false, 'ordinary parent is not an admin');
select throws_ok($$select * from public.list_content_review_queue()$$, 'content admin required', 'parent cannot list queue');
select throws_ok(
  $$select public.decide_content_review((select id from private.content_review_queue where request_id='r9-approve'), 'approved', null)$$,
  'permission denied for schema private', 'browser cannot resolve private queue ids directly'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
select is(public.is_content_admin(), true, 'allowlisted user is admin');
select results_eq($$select count(*)::bigint from public.list_content_review_queue()$$, $$values (3::bigint)$$, 'admin lists queue');
select is(public.decide_content_review(
  '91000000-0000-0000-0000-000000000001', 'approved', 'safe'), 'approved', 'admin approves');
select is(public.decide_content_review(
  '91000000-0000-0000-0000-000000000002', 'rejected', 'not suitable'), 'rejected', 'admin rejects');
reset role;

select is((select status from private.content_review_queue where request_id='r9-approve'), 'approved', 'approved status stored');
select isnt((select story from private.content_review_queue where request_id='r9-approve'), null, 'approved body retained');
select is((select count(*) from public.published_story_versions where source_request_id='r9-approve'), 1::bigint, 'approved story published');
select is((select status from private.content_review_queue where request_id='r9-reject'), 'rejected', 'rejected status stored');
select is((select story from private.content_review_queue where request_id='r9-reject'), null, 'rejected body erased');
select is(private.expire_content_review_queue(now()), 1, 'expired pending content purged');
select is((select story from private.content_review_queue where request_id='r9-expire'), null, 'expired body erased');
select is((select count(*) from private.content_review_decisions), 3::bigint, 'minimal decision audit retained');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.decide_content_review((select id from private.content_review_queue where request_id='r9-approve'), 'approved', null)$$,
  'content admin required', 'unauthenticated caller cannot decide'
);

select ok(not has_function_privilege('authenticated',
  'public.submit_generated_story(text,jsonb,text,double precision,jsonb,timestamptz)', 'execute'),
  'browser clients cannot submit generated stories');

insert into private.content_generation_runs
(request_id, story_id, status, generator_model, supervisor_model, prompt_hash, schema_version,
 safety_rules_version, guidance_version, generated_story, generated_story_version)
values
('r9-auto-publish', 'story-d', 'draft', 'g', 'r', 'h4', 's', 'safe', 'guide', '{"id":"story-d"}', 1),
('r9-auto-queue', 'story-e', 'draft', 'g', 'r', 'h5', 's', 'safe', 'guide', '{"id":"story-e"}', 1);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(public.submit_generated_story('r9-auto-publish', '{"id":"story-d"}', '1.1.0', 0.95, '[]', now() + interval '15 days'), 'published', 'clean draft auto-publishes');
select is(public.submit_generated_story('r9-auto-queue', '{"id":"story-e"}', '1.1.0', 0.75, '["reviewer_disagreement"]', now() + interval '15 days'), 'queued_for_review', 'suspicious draft enters queue');
reset role;
select is((select count(*) from public.published_story_versions where source_request_id='r9-auto-publish'), 1::bigint, 'auto-published story is readable');
select is((select status from private.content_review_queue where request_id='r9-auto-queue'), 'pending', 'routed queue item awaits review');

select * from finish();
rollback;
