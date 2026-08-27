begin;

select plan(13);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

select ok(
  not has_table_privilege('anon', 'public.parent_profiles', 'select,insert,update,delete'),
  'signed-out users have no parent profile privileges'
);

select ok(
  not has_table_privilege('anon', 'public.child_profiles', 'select,insert,update,delete'),
  'signed-out users have no child profile privileges'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$insert into public.parent_profiles (
      id,
      guardian_confirmed_at,
      guardian_declaration_version,
      privacy_notice_version
    ) values (
      '11111111-1111-1111-1111-111111111111',
      now(),
      'guardian-v1',
      'privacy-v1'
    )$$,
  'owner creates their parent profile'
);

select lives_ok(
  $$select public.set_parent_pin('2468')$$,
  'owner configures a four-digit parent PIN'
);

select results_eq(
  $$select public.verify_parent_pin('2468')$$,
  array[true],
  'correct parent PIN is accepted'
);

select results_eq(
  $$select public.verify_parent_pin('1111')$$,
  array[false],
  'incorrect parent PIN is rejected'
);

select lives_ok(
  $$insert into public.child_profiles (
      id,
      parent_id,
      nickname,
      birth_month,
      birth_year
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'Mavi',
      8,
      2023
    )$$,
  'owner creates their child profile'
);

select results_eq(
  $$select nickname from public.child_profiles$$,
  array['Mavi'::text],
  'owner reads their child profile'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$select * from public.parent_profiles$$,
  'another parent cannot read the owner parent profile'
);

select is_empty(
  $$select * from public.child_profiles$$,
  'another parent cannot read the owner child profile'
);

select throws_ok(
  $$insert into public.child_profiles (
      parent_id,
      nickname,
      birth_month,
      birth_year
    ) values (
      '11111111-1111-1111-1111-111111111111',
      'Yetkisiz',
      8,
      2023
    )$$,
  '42501',
  null,
  'another parent cannot create a child for the owner'
);

select throws_ok(
  $$select public.set_parent_pin('12')$$,
  '22023',
  null,
  'PIN must contain exactly four digits'
);

reset role;

select ok(
  not has_function_privilege('anon', 'public.verify_parent_pin(text)', 'execute'),
  'signed-out users cannot call parent PIN verification'
);

select * from finish();
rollback;
