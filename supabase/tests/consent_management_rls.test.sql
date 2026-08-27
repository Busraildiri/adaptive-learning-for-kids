begin;

select plan(19);

insert into auth.users (id, email)
values
  ('33333333-3333-3333-3333-333333333333', 'consent-owner@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'consent-other@example.com');

insert into public.parent_profiles (
  id,
  guardian_confirmed_at,
  guardian_declaration_version,
  privacy_notice_version
)
values
  (
    '33333333-3333-3333-3333-333333333333',
    now(),
    'guardian-v1',
    'privacy-v1'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    now(),
    'guardian-v1',
    'privacy-v1'
  );

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select lives_ok(
  $$insert into public.child_profiles (
      id,
      parent_id,
      nickname,
      birth_month,
      birth_year
    ) values (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '33333333-3333-3333-3333-333333333333',
      'Mavi',
      8,
      2023
    )$$,
  'owner creates a minimal child profile'
);

select results_eq(
  $$select count(*) from public.child_consent_preferences$$,
  array[3::bigint],
  'three independent consent preferences are initialized'
);

select results_eq(
  $$select count(*) from public.child_consent_preferences where enabled$$,
  array[3::bigint],
  'every preference starts enabled for a newly created child profile'
);

select results_eq(
  $$select count(*) from public.child_consent_preferences
    where enabled and granted_at is not null and withdrawn_at is null$$,
  array[3::bigint],
  'automatically enabled preferences have consistent timestamps'
);

select throws_ok(
  $$insert into public.child_profiles (
      parent_id,
      nickname,
      birth_month,
      birth_year,
      favorite_animals
    ) values (
      '33333333-3333-3333-3333-333333333333',
      'İzinsiz',
      8,
      2023,
      array['kedi']
    )$$,
  '42501',
  null,
  'optional profile data cannot be collected before personalization consent'
);

select throws_ok(
  $$select public.set_child_personalization(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      true,
      'wrong-version',
      array['tavşan'],
      array['balon'],
      array['renkler']
    )$$,
  '22023',
  null,
  'a stale or unknown personalization notice cannot grant consent'
);

select lives_ok(
  $$select public.set_child_personalization(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      true,
      'personalization-v1',
      array['tavşan'],
      array['balon'],
      array['renkler']
    )$$,
  'owner enables personalization and saves optional profile data atomically'
);

select results_eq(
  $$select enabled from public.child_consent_preferences
    where child_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and consent_type = 'personalization'$$,
  array[true],
  'personalization preference is enabled'
);

select results_eq(
  $$select favorite_animals from public.child_profiles
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  $$values (array['tavşan']::text[])$$,
  'consented personalization data is stored'
);

select lives_ok(
  $$select public.set_child_personalization(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      false,
      'personalization-v1'
    )$$,
  'owner withdraws personalization consent'
);

select results_eq(
  $$select
      not enabled and withdrawn_at is not null
    from public.child_consent_preferences
    where child_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and consent_type = 'personalization'$$,
  array[true],
  'withdrawal is timestamped'
);

select results_eq(
  $$select
      cardinality(favorite_animals) = 0
      and cardinality(favorite_toys) = 0
      and cardinality(interests) = 0
    from public.child_profiles
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  array[true],
  'withdrawing personalization clears optional profile data'
);

select lives_ok(
  $$select public.set_child_consent(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'learning_observations',
      true,
      'learning-observations-v1'
    )$$,
  'a parent can enable learning observations for the 2-4 age band'
);

select results_eq(
  $$select enabled from public.child_consent_preferences
    where child_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and consent_type = 'learning_observations'$$,
  array[true],
  'the learning observation choice is stored independently'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is_empty(
  $$select * from public.child_consent_preferences$$,
  'another parent cannot read the owner consent preferences'
);

select throws_ok(
  $$select public.set_child_consent(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'learning_observations',
      false,
      'learning-observations-v1'
    )$$,
  '42501',
  null,
  'another parent cannot change the owner consent preferences'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.child_consent_preferences', 'select,insert,update,delete'),
  'signed-out users have no consent table privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.child_consent_preferences', 'insert,update,delete'),
  'signed-in clients cannot bypass audited consent functions'
);

select ok(
  not has_table_privilege('authenticated', 'private.child_consent_audit_log', 'select,insert,update,delete'),
  'mobile clients cannot access the private consent audit log'
);

select * from finish();
rollback;
