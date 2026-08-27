begin;

select plan(8);

insert into auth.users (id, email)
values
  ('55555555-5555-4555-8555-555555555555', 'event-owner@example.com'),
  ('66666666-6666-4666-8666-666666666666', 'event-other@example.com');

insert into public.parent_profiles (
  id,
  guardian_confirmed_at,
  guardian_declaration_version,
  privacy_notice_version
)
values
  ('55555555-5555-4555-8555-555555555555', now(), 'guardian-v1', 'privacy-v1'),
  ('66666666-6666-4666-8666-666666666666', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

insert into public.child_profiles (id, parent_id, nickname, birth_month, birth_year)
values (
  '77777777-7777-4777-8777-777777777777',
  '55555555-5555-4555-8555-555555555555',
  'Mavi',
  8,
  2023
);

select lives_ok(
  $$select public.sync_interaction_events('[
    {
      "schemaVersion": 1,
      "eventId": "88888888-8888-4888-8888-888888888881",
      "sessionId": "99999999-9999-4999-8999-999999999999",
      "sequenceNumber": 1,
      "childId": "77777777-7777-4777-8777-777777777777",
      "activityId": "mino-story-v1",
      "eventType": "activity_started",
      "occurredAt": "2026-08-27T09:00:00.000Z",
      "payload": {}
    },
    {
      "schemaVersion": 1,
      "eventId": "88888888-8888-4888-8888-888888888882",
      "sessionId": "99999999-9999-4999-8999-999999999999",
      "sequenceNumber": 2,
      "childId": "77777777-7777-4777-8777-777777777777",
      "activityId": "mino-story-v1",
      "eventType": "step_presented",
      "occurredAt": "2026-08-27T09:00:01.000Z",
      "payload": {"stepId": "color-choice"}
    }
  ]'::jsonb)$$,
  'an ordered owner batch is accepted'
);

reset role;
select results_eq(
  $$select array_agg(sequence_number order by sequence_number) from private.interaction_events$$,
  $$values (array[1, 2]::integer[])$$,
  'event sequence is preserved'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select results_eq(
  $$select public.sync_interaction_events('[{
    "schemaVersion":1,
    "eventId":"88888888-8888-4888-8888-888888888881",
    "sessionId":"99999999-9999-4999-8999-999999999999",
    "sequenceNumber":1,
    "childId":"77777777-7777-4777-8777-777777777777",
    "activityId":"mino-story-v1",
    "eventType":"activity_started",
    "occurredAt":"2026-08-27T09:00:00.000Z",
    "payload":{}
  }]'::jsonb)$$,
  array['{"acceptedCount": 0, "duplicateCount": 1}'::jsonb],
  'retrying the same event id is idempotent'
);

select throws_ok(
  $$select public.sync_interaction_events('[
    {"schemaVersion":1,"eventId":"88888888-8888-4888-8888-888888888883","sessionId":"99999999-9999-4999-8999-999999999999","sequenceNumber":4,"childId":"77777777-7777-4777-8777-777777777777","activityId":"mino-story-v1","eventType":"step_presented","occurredAt":"2026-08-27T09:00:04.000Z","payload":{}},
    {"schemaVersion":1,"eventId":"88888888-8888-4888-8888-888888888884","sessionId":"99999999-9999-4999-8999-999999999999","sequenceNumber":3,"childId":"77777777-7777-4777-8777-777777777777","activityId":"mino-story-v1","eventType":"step_presented","occurredAt":"2026-08-27T09:00:03.000Z","payload":{}}
  ]'::jsonb)$$,
  '22023',
  null,
  'out-of-order events are rejected'
);

set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
select throws_ok(
  $$select public.sync_interaction_events('[{
    "schemaVersion":1,"eventId":"88888888-8888-4888-8888-888888888885","sessionId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","sequenceNumber":1,"childId":"77777777-7777-4777-8777-777777777777","activityId":"mino-story-v1","eventType":"activity_started","occurredAt":"2026-08-27T09:00:00.000Z","payload":{}
  }]'::jsonb)$$,
  '42501',
  null,
  'another parent cannot sync events for the child'
);

set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select public.set_child_consent(
  '77777777-7777-4777-8777-777777777777',
  'learning_observations',
  false,
  'learning-observations-v1'
);

select throws_ok(
  $$select public.sync_interaction_events('[{
    "schemaVersion":1,"eventId":"88888888-8888-4888-8888-888888888886","sessionId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","sequenceNumber":1,"childId":"77777777-7777-4777-8777-777777777777","activityId":"mino-story-v1","eventType":"activity_started","occurredAt":"2026-08-27T09:00:00.000Z","payload":{}
  }]'::jsonb)$$,
  '42501',
  null,
  'events are rejected after learning observation consent is withdrawn'
);

select throws_ok(
  $$select * from private.interaction_events$$,
  '42501',
  null,
  'mobile clients cannot read the private event table'
);

reset role;
select results_eq(
  $$select count(*) from private.interaction_events$$,
  array[2::bigint],
  'retries and rejected batches create no extra rows'
);

select * from finish();
rollback;
