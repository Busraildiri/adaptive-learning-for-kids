begin;
select plan(6);

insert into auth.users (id, email)
values ('45454545-4545-4454-8454-454545454545', 'game-variant-owner@example.com');
insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values ('45454545-4545-4454-8454-454545454545', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '45454545-4545-4454-8454-454545454545';
insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '56565656-5656-4565-8565-565656565656',
  '45454545-4545-4454-8454-454545454545',
  'Ece', 8, 2023
);
select public.set_child_personalization(
  '56565656-5656-4565-8565-565656565656', false, 'personalization-v1', '{}', '{}', '{}'
);

select results_eq(
  $$select public.select_game_variant_preference(
      '56565656-5656-4565-8565-565656565656', '2-4', 'growing'
    ) ->> 'reasonCode'$$,
  array['personalization_disabled'],
  'personalization consent is required independently'
);

select public.set_child_personalization(
  '56565656-5656-4565-8565-565656565656', true, 'personalization-v1', '{}', '{}', '{}'
);
select public.set_child_consent(
  '56565656-5656-4565-8565-565656565656',
  'learning_observations', true, 'learning-observations-v1'
);

select results_eq(
  $$select public.select_game_variant_preference(
      '56565656-5656-4565-8565-565656565656', '2-4', 'growing'
    ) ->> 'reasonCode'$$,
  array['insufficient_game_sessions'],
  'no game session cannot personalize a variant'
);
reset role;

insert into private.interaction_events (
  event_id, parent_id, child_id, session_id, sequence_number, schema_version,
  activity_id, event_type, occurred_at, payload
)
select
  gen_random_uuid(),
  '45454545-4545-4454-8454-454545454545',
  '56565656-5656-4565-8565-565656565656',
  session_id,
  sequence_number,
  1,
  'game-a',
  event_type,
  occurred_at,
  payload
from (values
  ('67676767-6767-4676-8676-676767676761'::uuid, 1, 'activity_started', '2026-08-27T09:00:00Z'::timestamptz, '{"activityKind":"game","ageBand":"2-4","difficulty":"growing"}'::jsonb),
  ('67676767-6767-4676-8676-676767676761'::uuid, 2, 'retry_requested', '2026-08-27T09:00:03Z'::timestamptz, '{}'::jsonb),
  ('67676767-6767-4676-8676-676767676761'::uuid, 3, 'activity_completed', '2026-08-27T09:00:08Z'::timestamptz, '{}'::jsonb),
  ('67676767-6767-4676-8676-676767676762'::uuid, 1, 'activity_started', '2026-08-28T09:00:00Z'::timestamptz, '{"activityKind":"game","ageBand":"2-4","difficulty":"growing"}'::jsonb),
  ('67676767-6767-4676-8676-676767676762'::uuid, 2, 'hint_requested', '2026-08-28T09:00:03Z'::timestamptz, '{}'::jsonb),
  ('67676767-6767-4676-8676-676767676762'::uuid, 3, 'activity_completed', '2026-08-28T09:00:08Z'::timestamptz, '{}'::jsonb),
  ('67676767-6767-4676-8676-676767676763'::uuid, 1, 'activity_started', '2026-08-28T10:00:00Z'::timestamptz, '{"activityKind":"game","ageBand":"2-4","difficulty":"growing"}'::jsonb),
  ('67676767-6767-4676-8676-676767676763'::uuid, 2, 'activity_completed', '2026-08-28T10:00:08Z'::timestamptz, '{}'::jsonb)
) as fixture(session_id, sequence_number, event_type, occurred_at, payload);

set local role authenticated;
set local request.jwt.claim.sub = '45454545-4545-4454-8454-454545454545';

select results_eq(
  $$select public.select_game_variant_preference(
      '56565656-5656-4565-8565-565656565656', '2-4', 'growing'
    ) ->> 'preferredDifficulty'$$,
  array['starter'],
  'support in two sessions selects one easier approved level'
);
select results_eq(
  $$select public.select_game_variant_preference(
      '56565656-5656-4565-8565-565656565656', '2-4', 'growing'
    ) ->> 'supportingSessionCount'$$,
  array['2'],
  'the explanation is backed by two distinct sessions'
);

reset role;

select ok(
  (select explanation !~* '(%|yüzde|yaşıt|akran|puan|skor|tanı|teşhis)'
   from private.game_variant_decision_log order by id desc limit 1),
  'decision explanation contains no score, diagnosis, or peer comparison'
);

select ok(
  (select count(*) >= 4 from private.game_variant_decision_log),
  'every decision is appended to the private audit log'
);

select * from finish();
rollback;
