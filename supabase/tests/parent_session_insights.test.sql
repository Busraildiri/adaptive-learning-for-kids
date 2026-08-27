begin;

select plan(8);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'summary-owner@example.com'),
  ('99999999-9999-4999-8999-999999999999', 'summary-other@example.com');

insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values
  ('11111111-1111-4111-8111-111111111111', now(), 'guardian-v1', 'privacy-v1'),
  ('99999999-9999-4999-8999-999999999999', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Mavi', 8, 2023
);

do $$
begin
  perform public.set_child_consent(
    '22222222-2222-4222-8222-222222222222',
    'learning_observations', false, 'learning-observations-v1'
  );
end;
$$;

select results_eq(
  $$select public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    ) ->> 'status'$$,
  array['consent_required'],
  'summary fails closed without learning-observation consent'
);

select lives_ok(
  $$select public.set_child_consent(
      '22222222-2222-4222-8222-222222222222',
      'learning_observations', true, 'learning-observations-v1'
    )$$,
  'the owner can enable learning observations'
);

select results_eq(
  $$select public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    ) ->> 'status'$$,
  array['no_activity'],
  'cold start returns no activity rather than an inference'
);

reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  session_id,
  sequence_number,
  1,
  activity_id,
  event_type,
  occurred_at,
  payload
from (values
  ('33333333-3333-4333-8333-333333333331'::uuid, 1, 'story-a', 'step_presented', '2026-08-27T10:00:00Z'::timestamptz, '{"stepId":"emotion"}'::jsonb),
  ('33333333-3333-4333-8333-333333333331'::uuid, 2, 'story-a', 'choice_selected', '2026-08-27T10:00:02Z'::timestamptz, '{"stepId":"emotion","choiceId":"sad"}'::jsonb),
  ('33333333-3333-4333-8333-333333333331'::uuid, 3, 'story-a', 'activity_completed', '2026-08-27T10:00:04Z'::timestamptz, '{}'::jsonb),
  ('33333333-3333-4333-8333-333333333332'::uuid, 1, 'story-b', 'step_presented', '2026-08-27T11:00:00Z'::timestamptz, '{"stepId":"emotion"}'::jsonb),
  ('33333333-3333-4333-8333-333333333332'::uuid, 2, 'story-b', 'choice_selected', '2026-08-27T11:00:02Z'::timestamptz, '{"stepId":"emotion","choiceId":"happy"}'::jsonb),
  ('33333333-3333-4333-8333-333333333332'::uuid, 3, 'story-b', 'activity_completed', '2026-08-27T11:00:04Z'::timestamptz, '{}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 1, 'story-a', 'step_presented', '2026-08-27T12:00:00Z'::timestamptz, '{"stepId":"emotion"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 2, 'story-a', 'choice_selected', '2026-08-27T12:00:02Z'::timestamptz, '{"stepId":"emotion","choiceId":"sad"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 3, 'story-a', 'activity_completed', '2026-08-27T12:00:04Z'::timestamptz, '{}'::jsonb)
) as fixture(session_id, sequence_number, activity_id, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$select public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    ) ->> 'status'$$,
  array['ready'],
  'three eligible sessions open the qualitative observation gate'
);

select results_eq(
  $$select public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    ) #>> '{observation,code}'$$,
  array['varied_participation'],
  'varied participation uses a fixed neutral template'
);

select results_eq(
  $$select (public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    ) -> 'recentSessions' -> 0) ? 'choiceId'$$,
  array[false],
  'parent response never exposes a raw choice'
);

set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select throws_ok(
  $$select public.get_parent_session_summary(
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '42501',
  'Child profile not found',
  'another parent cannot read the child summary'
);

reset role;

select ok(
  (select count(*) >= 3 from private.parent_session_summary_audit),
  'summary eligibility decisions are appended to the private audit log'
);

select * from finish();
rollback;
