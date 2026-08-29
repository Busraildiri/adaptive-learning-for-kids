begin;
select plan(8);

insert into auth.users (id, email)
values ('41414141-4141-4414-8414-414141414141', 'rag-insight-owner@example.com');
insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values ('41414141-4141-4414-8414-414141414141', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '41414141-4141-4414-8414-414141414141';
insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '42424242-4242-4424-8424-424242424242',
  '41414141-4141-4414-8414-414141414141',
  'Ece', 8, 2023
);
select public.set_child_consent(
  '42424242-4242-4424-8424-424242424242',
  'learning_observations', true, 'learning-observations-v1'
);
reset role;

insert into private.learning_evidence (
  session_id, parent_id, child_id, activity_id, classification, reason_code,
  distinct_response_count, duplicate_response_count, normalized_responses,
  threshold_version, derived_at
)
select
  session_id,
  '41414141-4141-4414-8414-414141414141',
  '42424242-4242-4424-8424-424242424242',
  activity_id,
  'valid_evidence',
  'completed_with_multiple_responses',
  2,
  0,
  '[]'::jsonb,
  'evidence-thresholds-v1',
  derived_at
from (values
  ('43434343-4343-4434-8434-434343434341'::uuid, 'story-a', '2026-08-27T09:00:00Z'::timestamptz),
  ('43434343-4343-4434-8434-434343434342'::uuid, 'story-b', '2026-08-27T10:00:00Z'::timestamptz),
  ('43434343-4343-4434-8434-434343434343'::uuid, 'story-a', '2026-08-28T09:00:00Z'::timestamptz)
) as fixture(session_id, activity_id, derived_at);

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '41414141-4141-4414-8414-414141414141',
  '42424242-4242-4424-8424-424242424242',
  session_id,
  sequence_number,
  1,
  'tomo-routine-001',
  event_type,
  occurred_at,
  payload
from (values
  ('44444444-4444-4444-8444-444444444441'::uuid, 1, 'activity_started', '2026-08-27T10:00:00Z'::timestamptz, '{"activityKind":"game","privateNote":"must-not-leak"}'::jsonb),
  ('44444444-4444-4444-8444-444444444441'::uuid, 2, 'retry_requested', '2026-08-27T10:00:03Z'::timestamptz, '{"choiceId":"raw-choice"}'::jsonb),
  ('44444444-4444-4444-8444-444444444441'::uuid, 3, 'activity_completed', '2026-08-27T10:00:10Z'::timestamptz, '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444442'::uuid, 1, 'activity_started', '2026-08-28T10:00:00Z'::timestamptz, '{"activityKind":"game"}'::jsonb),
  ('44444444-4444-4444-8444-444444444442'::uuid, 2, 'retry_requested', '2026-08-28T10:00:03Z'::timestamptz, '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444442'::uuid, 3, 'activity_completed', '2026-08-28T10:00:10Z'::timestamptz, '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444443'::uuid, 1, 'activity_started', '2026-08-28T11:00:00Z'::timestamptz, '{"activityKind":"game"}'::jsonb),
  ('44444444-4444-4444-8444-444444444443'::uuid, 2, 'activity_abandoned', '2026-08-28T11:00:05Z'::timestamptz, '{}'::jsonb)
) as fixture(session_id, sequence_number, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '41414141-4141-4414-8414-414141414141';

select results_eq(
  $$select public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  ) ->> 'source'$$,
  array['consented_session_event_projection'],
  'retrieval identifies its bounded evidence source'
);
select is(
  jsonb_array_length(public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  ) -> 'storyEvidence'),
  3,
  'eligible story evidence is retrieved'
);
select is(
  jsonb_array_length(public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  ) -> 'gameEvidence'),
  3,
  'eligible game evidence is retrieved'
);
select results_eq(
  $$select public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  ) #>> '{gameEvidence,1,signals,1}'$$,
  array['retried'],
  'retrieval projects an allow-listed retry signal'
);
select ok(
  public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  )::text !~ 'must-not-leak|raw-choice|choiceId|privateNote',
  'raw event payload and choices are not returned'
);
reset role;
select ok(
  (select count(*) >= 5 from private.parent_insight_retrieval_audit
   where child_id = '42424242-4242-4424-8424-424242424242'),
  'every evidence retrieval is auditable'
);
set local role authenticated;
set local request.jwt.claim.sub = '41414141-4141-4414-8414-414141414141';
select results_eq(
  $$select public.get_parent_insight_evidence(
    '42424242-4242-4424-8424-424242424242'
  ) ->> 'retrievalPolicyVersion'$$,
  array['parent-insight-retrieval-v1'],
  'retrieval response is policy-versioned'
);
select throws_ok(
  $$select public.get_parent_insight_evidence('00000000-0000-4000-8000-000000000000')$$,
  '42501',
  'Child profile not found',
  'a parent cannot retrieve evidence for an unavailable child'
);

select * from finish();
rollback;
