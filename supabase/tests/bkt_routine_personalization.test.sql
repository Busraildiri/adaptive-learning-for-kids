begin;
select plan(5);

insert into auth.users (id, email)
values ('81818181-8181-4181-8181-818181818181', 'bkt-owner@example.com');
insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values ('81818181-8181-4181-8181-818181818181', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '81818181-8181-4181-8181-818181818181';
insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '82828282-8282-4282-8282-828282828282',
  '81818181-8181-4181-8181-818181818181',
  'Ada', 6, 2023
);
select public.set_child_personalization(
  '82828282-8282-4282-8282-828282828282', true, 'personalization-v1', '{}', '{}', '{}'
);
select public.set_child_consent(
  '82828282-8282-4282-8282-828282828282',
  'learning_observations', true, 'learning-observations-v1'
);

select results_eq(
  $$select public.select_bkt_routine_variant(
      '82828282-8282-4282-8282-828282828282', '2-4', 'starter'
    ) ->> 'reasonCode'$$,
  array['insufficient_game_sessions'],
  'BKT does not adapt without enough opportunities across sessions'
);
reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '81818181-8181-4181-8181-818181818181',
  '82828282-8282-4282-8282-828282828282',
  '84848484-8484-4484-8484-848484848484'::uuid,
  sequence_number,
  1,
  'mino-routine-path-001',
  event_type,
  occurred_at,
  payload
from (values
  (1, 'activity_started', '2026-08-27T08:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"sequence_and_place","ageBand":"2-4","difficulty":"starter"}'::jsonb),
  (2, 'choice_selected', '2026-08-27T08:00:03Z'::timestamptz, '{"stepId":"immediate-a","bktCorrect":true}'::jsonb),
  (3, 'choice_selected', '2026-08-27T08:00:06Z'::timestamptz, '{"stepId":"immediate-b","bktCorrect":true}'::jsonb),
  (4, 'choice_selected', '2026-08-27T08:00:09Z'::timestamptz, '{"stepId":"immediate-c","bktCorrect":true}'::jsonb),
  (5, 'choice_selected', '2026-08-27T08:00:12Z'::timestamptz, '{"stepId":"immediate-d","bktCorrect":true}'::jsonb)
) as fixture(sequence_number, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '81818181-8181-4181-8181-818181818181';
select results_eq(
  $$select public.select_bkt_routine_variant(
      '82828282-8282-4282-8282-828282828282', '2-4', 'starter'
    ) ->> 'preferredDifficulty'$$,
  array['growing'],
  'four correct opportunities raise the routine level immediately in one session'
);
reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '81818181-8181-4181-8181-818181818181',
  '82828282-8282-4282-8282-828282828282',
  session_id,
  sequence_number,
  1,
  'mino-routine-path-001',
  event_type,
  occurred_at,
  payload
from (values
  ('83838383-8383-4383-8383-838383838381'::uuid, 1, 'activity_started', '2026-08-27T09:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"sequence_and_place","ageBand":"2-4","difficulty":"starter"}'::jsonb),
  ('83838383-8383-4383-8383-838383838381'::uuid, 2, 'choice_selected', '2026-08-27T09:00:03Z'::timestamptz, '{"stepId":"a","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838381'::uuid, 3, 'choice_selected', '2026-08-27T09:00:06Z'::timestamptz, '{"stepId":"b","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838381'::uuid, 4, 'choice_selected', '2026-08-27T09:00:09Z'::timestamptz, '{"stepId":"c","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838382'::uuid, 1, 'activity_started', '2026-08-28T09:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"sequence_and_place","ageBand":"2-4","difficulty":"starter"}'::jsonb),
  ('83838383-8383-4383-8383-838383838382'::uuid, 2, 'choice_selected', '2026-08-28T09:00:03Z'::timestamptz, '{"stepId":"d","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838382'::uuid, 3, 'choice_selected', '2026-08-28T09:00:06Z'::timestamptz, '{"stepId":"e","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838382'::uuid, 4, 'choice_selected', '2026-08-28T09:00:09Z'::timestamptz, '{"stepId":"f","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838383'::uuid, 1, 'activity_started', '2026-08-28T10:00:00Z'::timestamptz, '{"activityKind":"game","mechanic":"sequence_and_place","ageBand":"2-4","difficulty":"starter"}'::jsonb),
  ('83838383-8383-4383-8383-838383838383'::uuid, 2, 'choice_selected', '2026-08-28T10:00:03Z'::timestamptz, '{"stepId":"g","bktCorrect":true}'::jsonb),
  ('83838383-8383-4383-8383-838383838383'::uuid, 3, 'choice_selected', '2026-08-28T10:00:06Z'::timestamptz, '{"stepId":"h","bktCorrect":true}'::jsonb)
) as fixture(session_id, sequence_number, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '81818181-8181-4181-8181-818181818181';

select results_eq(
  $$select public.select_bkt_routine_variant(
      '82828282-8282-4282-8282-828282828282', '2-4', 'growing'
    ) ->> 'preferredDifficulty'$$,
  array['advanced'],
  'eight correct opportunities across three sessions select the advanced routine level'
);

select results_eq(
  $$select public.select_bkt_routine_variant(
      '82828282-8282-4282-8282-828282828282', '2-4', 'starter'
    ) ->> 'preferredDifficulty'$$,
  array['growing'],
  'BKT changes at most one approved level at a time'
);

select ok(
  public.select_bkt_routine_variant(
    '82828282-8282-4282-8282-828282828282', '2-4', 'starter'
  ) ->> 'explanation' !~* '(BKT|%|puan|skor|tanı|teşhis)',
  'child-facing explanation exposes neither methodology nor diagnostic scoring'
);

select * from finish();
rollback;
