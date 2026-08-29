begin;
select plan(5);

insert into auth.users (id, email)
values ('12121212-1212-4212-8212-121212121212', 'game-insight-owner@example.com');
insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values ('12121212-1212-4212-8212-121212121212', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '12121212-1212-4212-8212-121212121212';
insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '23232323-2323-4232-8232-232323232323',
  '12121212-1212-4212-8212-121212121212',
  'Ada', 8, 2023
);
select public.set_child_consent(
  '23232323-2323-4232-8232-232323232323',
  'learning_observations', true, 'learning-observations-v1'
);
reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '12121212-1212-4212-8212-121212121212',
  '23232323-2323-4232-8232-232323232323',
  session_id,
  sequence_number,
  1,
  'fish-patterns-001',
  event_type,
  occurred_at,
  payload
from (values
  ('34343434-3434-4343-8343-343434343431'::uuid, 1, 'activity_started', '2026-08-27T10:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"fish_patterns"}'::jsonb),
  ('34343434-3434-4343-8343-343434343431'::uuid, 2, 'retry_requested', '2026-08-27T10:00:03Z'::timestamptz, '{"stepId":"round1"}'::jsonb),
  ('34343434-3434-4343-8343-343434343431'::uuid, 3, 'activity_completed', '2026-08-27T10:00:10Z'::timestamptz, '{}'::jsonb),
  ('34343434-3434-4343-8343-343434343432'::uuid, 1, 'activity_started', '2026-08-28T10:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"fish_patterns"}'::jsonb),
  ('34343434-3434-4343-8343-343434343432'::uuid, 2, 'retry_requested', '2026-08-28T10:00:03Z'::timestamptz, '{"stepId":"round1"}'::jsonb),
  ('34343434-3434-4343-8343-343434343432'::uuid, 3, 'activity_completed', '2026-08-28T10:00:10Z'::timestamptz, '{}'::jsonb),
  ('34343434-3434-4343-8343-343434343433'::uuid, 1, 'activity_started', '2026-08-28T11:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"fish_patterns"}'::jsonb),
  ('34343434-3434-4343-8343-343434343433'::uuid, 2, 'activity_abandoned', '2026-08-28T11:00:05Z'::timestamptz, '{}'::jsonb)
) as fixture(session_id, sequence_number, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '12121212-1212-4212-8212-121212121212';

select results_eq(
  $$select public.get_parent_session_summary(
      '23232323-2323-4232-8232-232323232323'
    ) ->> 'gameStatus'$$,
  array['ready'],
  'three game sessions across two days open the game insight gate'
);
select results_eq(
  $$select public.get_parent_session_summary(
      '23232323-2323-4232-8232-232323232323'
    ) #>> '{gameInsights,0,code}'$$,
  array['continued_play'],
  'two completed sessions create a neutral continued-play card'
);
select results_eq(
  $$select public.get_parent_session_summary(
      '23232323-2323-4232-8232-232323232323'
    ) #>> '{gameInsights,1,code}'$$,
  array['tried_again'],
  'two retry sessions create a neutral retry card'
);
select is(
  jsonb_array_length(public.get_parent_session_summary(
    '23232323-2323-4232-8232-232323232323'
  ) -> 'recentGameSessions'),
  3,
  'recent game history lists session outcomes without raw choices'
);
select ok(
  (public.get_parent_session_summary(
    '23232323-2323-4232-8232-232323232323'
  ) -> 'gameInsights')::text !~* '(%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis)',
  'game insights contain no score, diagnosis, or peer comparison'
);

select * from finish();
rollback;
