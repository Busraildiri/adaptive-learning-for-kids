begin;

select plan(8);

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'evidence-owner@example.com');

insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now(), 'guardian-v1', 'privacy-v1'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Mavi', 8, 2023
);

reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, 1, 'story-a', 'step_presented', '2026-08-27T09:00:00Z', '{"stepId":"emotion"}'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 2, 1, 'story-a', 'choice_selected', '2026-08-27T09:00:00.1Z', '{"stepId":"emotion","choiceId":"sad"}'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 3, 1, 'story-a', 'choice_selected', '2026-08-27T09:00:00.2Z', '{"stepId":"emotion","choiceId":"angry"}'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 4, 1, 'story-a', 'activity_completed', '2026-08-27T09:00:02Z', '{}');

select results_eq(
  $$select classification from private.learning_evidence
    where session_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  array['limited_evidence'],
  'a single fast response is limited evidence rather than noise'
);

select results_eq(
  $$select reason_code from private.learning_evidence
    where session_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  array['single_fast_response'],
  'the fast-response reason remains explicit'
);

select results_eq(
  $$select duplicate_response_count from private.learning_evidence
    where session_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  array[1],
  'repeat taps are excluded and counted separately'
);

select results_eq(
  $$select normalized_responses -> 0 ->> 'choiceId' from private.learning_evidence
    where session_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  array['sad'],
  'the first meaningful response is preserved'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select results_eq(
  $$select public.select_next_activity(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      array['story-a', 'story-b']
    ) ->> 'selectedActivityId'$$,
  array['story-b'],
  'an unseen activity is selected before a completed activity'
);

reset role;
select results_eq(
  $$select reason_code from private.activity_decision_log order by id desc limit 1$$,
  array['unseen_activity'],
  'selection reason is logged'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.set_child_consent(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'learning_observations', false, 'learning-observations-v1'
);

select results_eq(
  $$select public.select_next_activity(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      array['story-a', 'story-b']
    ) ->> 'reasonCode'$$,
  array['consent_fallback'],
  'consent withdrawal switches selection to the general fallback'
);

select throws_ok(
  $$select * from private.learning_evidence$$,
  '42501', null,
  'mobile clients cannot read derived evidence'
);

select * from finish();
rollback;
