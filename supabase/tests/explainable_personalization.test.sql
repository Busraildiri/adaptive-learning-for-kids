begin;

select plan(9);

insert into auth.users (id, email)
values
  ('10101010-1010-4010-8010-101010101010', 'personalization-owner@example.com'),
  ('90909090-9090-4090-8090-909090909090', 'personalization-other@example.com');

insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values
  ('10101010-1010-4010-8010-101010101010', now(), 'guardian-v1', 'privacy-v1'),
  ('90909090-9090-4090-8090-909090909090', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '10101010-1010-4010-8010-101010101010';

insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '20202020-2020-4020-8020-202020202020',
  '10101010-1010-4010-8010-101010101010',
  'Deniz', 8, 2023
);

select public.set_child_personalization(
  '20202020-2020-4020-8020-202020202020', false, 'personalization-v1', '{}', '{}', '{}'
);

select results_eq(
  $$select public.select_personalized_activity(
      '20202020-2020-4020-8020-202020202020', array['story-a', 'story-b']
    ) ->> 'reasonCode'$$,
  array['personalization_disabled'],
  'personalization consent is required independently'
);

select public.set_child_personalization(
  '20202020-2020-4020-8020-202020202020', true, 'personalization-v1', '{}', '{}', '{}'
);
select public.set_child_consent(
  '20202020-2020-4020-8020-202020202020',
  'learning_observations', false, 'learning-observations-v1'
);

select results_eq(
  $$select public.select_personalized_activity(
      '20202020-2020-4020-8020-202020202020', array['story-a', 'story-b']
    ) ->> 'reasonCode'$$,
  array['observations_disabled'],
  'learning-observation consent is also required'
);

select public.set_child_consent(
  '20202020-2020-4020-8020-202020202020',
  'learning_observations', true, 'learning-observations-v1'
);

reset role;

insert into private.learning_evidence (
  session_id, parent_id, child_id, activity_id, classification, reason_code,
  distinct_response_count, duplicate_response_count, normalized_responses, threshold_version
)
select
  session_id,
  '10101010-1010-4010-8010-101010101010',
  '20202020-2020-4020-8020-202020202020',
  activity_id,
  'valid_evidence',
  'completed_with_multiple_responses',
  2,
  0,
  '[]'::jsonb,
  'evidence-thresholds-v1'
from (values
  ('30101010-1010-4010-8010-101010101010'::uuid, 'story-a'),
  ('30202020-2020-4020-8020-202020202020'::uuid, 'story-b'),
  ('30303030-3030-4030-8030-303030303030'::uuid, 'story-c'),
  ('30404040-4040-4040-8040-404040404040'::uuid, 'story-d')
) as evidence(session_id, activity_id);

set local role authenticated;
set local request.jwt.claim.sub = '10101010-1010-4010-8010-101010101010';

select results_eq(
  $$select public.select_personalized_activity(
      '20202020-2020-4020-8020-202020202020',
      array['story-a', 'story-b', 'story-c', 'story-d', 'story-e']
    ) ->> 'reasonCode'$$,
  array['insufficient_distinct_activities'],
  'four distinct eligible stories cannot open personalization'
);

reset role;

insert into private.learning_evidence (
  session_id, parent_id, child_id, activity_id, classification, reason_code,
  distinct_response_count, duplicate_response_count, normalized_responses, threshold_version
) values (
  '30505050-5050-4050-8050-505050505050',
  '10101010-1010-4010-8010-101010101010',
  '20202020-2020-4020-8020-202020202020',
  'story-e', 'valid_evidence', 'completed_with_multiple_responses', 2, 0, '[]',
  'evidence-thresholds-v1'
);

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
) values
  ('40101010-1010-4010-8010-101010101010', '10101010-1010-4010-8010-101010101010', '20202020-2020-4020-8020-202020202020', '50101010-1010-4010-8010-101010101010', 1, 1, 'story-a', 'activity_started', now() - interval '2 minutes', '{}'),
  ('40202020-2020-4020-8020-202020202020', '10101010-1010-4010-8010-101010101010', '20202020-2020-4020-8020-202020202020', '50202020-2020-4020-8020-202020202020', 1, 1, 'story-a', 'activity_started', now() - interval '1 minute', '{}');

set local role authenticated;
set local request.jwt.claim.sub = '10101010-1010-4010-8010-101010101010';

select results_eq(
  $$select public.select_personalized_activity(
      '20202020-2020-4020-8020-202020202020',
      array['story-a', 'story-b', 'story-c', 'story-d', 'story-e']
    ) ->> 'personalized'$$,
  array['true'],
  'five distinct eligible stories and a repeated multi-session signal open personalization'
);

select results_eq(
  $$select public.select_personalized_activity(
      '20202020-2020-4020-8020-202020202020',
      array['story-a', 'story-b', 'story-c', 'story-d', 'story-e']
    ) ->> 'reasonCode'$$,
  array['repeated_activity_preference'],
  'the recommendation records its limited observable reason'
);

select results_eq(
  $$select public.get_parent_personalization_status(
      '20202020-2020-4020-8020-202020202020'
    ) ->> 'eligible'$$,
  array['true'],
  'the parent status reports the five-story gate as open'
);

reset role;

select ok(
  not exists (
    select 1
    from private.personalized_activity_decision_log
    where explanation ~* '(%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis)'
  ),
  'decision explanations contain no percentages, scores, diagnoses, or peer comparisons'
);

set local role authenticated;
set local request.jwt.claim.sub = '90909090-9090-4090-8090-909090909090';

select throws_ok(
  $$select public.get_parent_personalization_status(
      '20202020-2020-4020-8020-202020202020'
    )$$,
  '42501',
  'Child profile not found',
  'another parent cannot read personalization status'
);

reset role;

select ok(
  (select count(*) >= 5 from private.personalized_activity_decision_log),
  'each decision is appended to the private audit log'
);

select * from finish();
rollback;
