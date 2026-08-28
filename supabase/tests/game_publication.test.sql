begin;
select plan(21);

select has_table('private', 'game_drafts', 'private game drafts exists');
select has_table('public', 'published_game_versions', 'published games exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('93000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'game-admin@example.test', ''),
  ('93000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'game-parent@example.test', '');
insert into private.content_admins(user_id) values ('93000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000002', true);
select ok(not has_function_privilege('authenticated', 'public.save_game_draft(jsonb,uuid)', 'execute'), 'browser cannot save game drafts');
select ok(not has_function_privilege('authenticated', 'public.publish_game_draft(text,uuid)', 'execute'), 'browser cannot publish game drafts');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  public.save_game_draft('{"id":"game-a","version":99,"status":"published","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '93000000-0000-0000-0000-000000000001')->>'status',
  'draft', 'server normalizes saved status');
select is((select game_version from private.game_drafts where game_id='game-a'), 1, 'first draft gets version one');
select is((select saved_by from private.game_drafts where game_id='game-a'), '93000000-0000-0000-0000-000000000001'::uuid, 'saving admin recorded');
select is(public.publish_game_draft('game-a', '93000000-0000-0000-0000-000000000001')->>'status', 'published', 'admin publishes draft');
select is((select count(*) from private.game_drafts where game_id='game-a'), 0::bigint, 'published draft removed');
select is((select count(*) from public.published_game_versions where game_id='game-a'), 1::bigint, 'published version stored');
select is((select published_by from public.published_game_versions where game_id='game-a'), '93000000-0000-0000-0000-000000000001'::uuid, 'publishing admin recorded');
select is(
  public.save_game_draft('{"id":"game-a","version":1,"status":"draft","ageBand":"4-7","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '93000000-0000-0000-0000-000000000001')->>'version',
  '2', 'next draft increments published version');
select is((select age_band from private.game_drafts where game_id='game-a'), '4-7', 'new draft age band stored');
select throws_ok(
  $$select public.save_game_draft('{"id":"bad","ageBand":"all","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '93000000-0000-0000-0000-000000000001')$$,
  'invalid age band', 'invalid age band rejected');
select throws_ok(
  $$select public.save_game_draft('{"id":"bad","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"camera"}', '93000000-0000-0000-0000-000000000001')$$,
  'unsupported game mechanic', 'unsupported mechanic rejected');
select throws_ok(
  $$select public.save_game_draft('{"id":"bad","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '93000000-0000-0000-0000-000000000002')$$,
  'content admin required', 'service route cannot act for a non-admin');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.published_game_versions), 1::bigint, 'signed-in parent reads published games');
select throws_ok($$select count(*) from private.game_drafts$$, 'permission denied for schema private', 'parent cannot read drafts');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.published_game_versions$$, 'permission denied for table published_game_versions', 'anonymous user cannot read games');
reset role;

select ok(has_function_privilege('service_role', 'public.save_game_draft(jsonb,uuid)', 'execute'), 'service role can save validated games');
select ok(has_function_privilege('service_role', 'public.publish_game_draft(text,uuid)', 'execute'), 'service role can publish validated games');

select * from finish();
rollback;
