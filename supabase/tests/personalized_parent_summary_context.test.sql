begin;
select plan(7);

insert into auth.users (id, email)
values
  ('51515151-5151-4515-8515-515151515151', 'profile-context-owner@example.com'),
  ('52525252-5252-4525-8525-525252525252', 'profile-context-other@example.com');

insert into public.parent_profiles (
  id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version
) values
  ('51515151-5151-4515-8515-515151515151', now(), 'guardian-v1', 'privacy-v1'),
  ('52525252-5252-4525-8525-525252525252', now(), 'guardian-v1', 'privacy-v1');

set local role authenticated;
set local request.jwt.claim.sub = '51515151-5151-4515-8515-515151515151';

insert into public.child_profiles (
  id, parent_id, nickname, birth_month, birth_year
) values
  (
    '53535353-5353-4535-8535-535353535351',
    '51515151-5151-4515-8515-515151515151',
    'Ece', 8, 2023
  ),
  (
    '53535353-5353-4535-8535-535353535352',
    '51515151-5151-4515-8515-515151515151',
    'Mert', 6, 2021
  );

select public.set_child_consent(
  '53535353-5353-4535-8535-535353535351',
  'learning_observations', true, 'learning-observations-v1'
);
select public.set_child_personalization(
  '53535353-5353-4535-8535-535353535351',
  true,
  'personalization-v1',
  array['tavşan'],
  array['bloklar'],
  array['uzay']
);
select public.set_child_consent(
  '53535353-5353-4535-8535-535353535352',
  'learning_observations', true, 'learning-observations-v1'
);
select public.set_child_personalization(
  '53535353-5353-4535-8535-535353535352',
  true,
  'personalization-v1',
  array['yunus'],
  array['tren'],
  array['deniz']
);

select results_eq(
  $$select public.get_personalized_parent_insight_evidence(
    '53535353-5353-4535-8535-535353535351'
  ) ->> 'schemaVersion'$$,
  array['2'],
  'personalized retrieval is schema-versioned'
);

select results_eq(
  $$select public.get_personalized_parent_insight_evidence(
    '53535353-5353-4535-8535-535353535351'
  ) #>> '{profileContext,nickname}'$$,
  array['Ece'],
  'selected child nickname is retrieved'
);

select results_eq(
  $$select public.get_personalized_parent_insight_evidence(
    '53535353-5353-4535-8535-535353535351'
  ) #>> '{profileContext,interests,0}'$$,
  array['uzay'],
  'selected child interest is retrieved when both consents are enabled'
);

select ok(
  public.get_personalized_parent_insight_evidence(
    '53535353-5353-4535-8535-535353535351'
  )::text !~ 'Mert|yunus|tren|deniz',
  'sibling profile context is never mixed into the selected child bundle'
);

reset role;
select ok(
  (
    select count(*) >= 4
    from private.parent_insight_profile_context_audit
    where child_id = '53535353-5353-4535-8535-535353535351'
      and personalization_context_included
  ),
  'every personalized profile context retrieval is auditable'
);

set local role authenticated;
set local request.jwt.claim.sub = '51515151-5151-4515-8515-515151515151';
select public.set_child_personalization(
  '53535353-5353-4535-8535-535353535351',
  false,
  'personalization-v1'
);

select is(
  jsonb_array_length(
    public.get_personalized_parent_insight_evidence(
      '53535353-5353-4535-8535-535353535351'
    ) #> '{profileContext,interests}'
  ),
  0,
  'profile preferences are excluded after personalization consent is disabled'
);

set local request.jwt.claim.sub = '52525252-5252-4525-8525-525252525252';
select throws_ok(
  $$select public.get_personalized_parent_insight_evidence(
    '53535353-5353-4535-8535-535353535351'
  )$$,
  '42501',
  'Child profile not found',
  'another parent cannot retrieve the child profile context'
);

select * from finish();
rollback;
