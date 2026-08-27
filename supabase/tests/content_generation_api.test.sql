begin;
select plan(4);

select has_function(
  'public',
  'record_content_generation_run',
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'jsonb', 'jsonb', 'integer', 'timestamp with time zone'],
  'server-only generation audit function exists'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$select public.record_content_generation_run(
    'forbidden-run', 'story-forbidden', 'rejected', 'producer', 'reviewer', 'hash',
    'schema-v1', 'safety-v1', 'guidance-v1', '["invalid_schema"]'::jsonb
  )$$,
  '42501',
  'permission denied for function record_content_generation_run',
  'authenticated clients cannot write generation audit records'
);

reset role;
set local role service_role;
set local request.jwt.claim.role = 'service_role';

select lives_ok(
  $$select public.record_content_generation_run(
    'manual-generation-run', 'generated-story', 'draft', 'producer', 'reviewer', 'hash',
    'schema-v1', 'safety-v1', 'guidance-v1', '[]'::jsonb,
    '{"id":"generated-story"}'::jsonb, 1, '2026-08-27T22:30:00Z'
  )$$,
  'service role can append an audited draft'
);

reset role;

select results_eq(
  $$select request_id from private.content_generation_runs where request_id = 'manual-generation-run'$$,
  array['manual-generation-run'],
  'the generation run is persisted in the private audit table'
);

select * from finish();
rollback;
