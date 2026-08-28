begin;
select plan(12);

select has_column('public', 'published_game_versions', 'archived_at', 'published game archive timestamp exists');
select has_column('public', 'published_game_versions', 'archived_by', 'publishing admin archive actor exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'catalog-admin@example.test', ''),
  ('94000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'catalog-parent@example.test', '');
insert into private.content_admins(user_id) values ('94000000-0000-0000-0000-000000000001');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.save_game_draft('{"id":"catalog-game","version":1,"status":"draft","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '94000000-0000-0000-0000-000000000001');
select is((select count(*) from public.list_game_catalog('94000000-0000-0000-0000-000000000001')), 1::bigint, 'catalog lists draft');
select public.publish_game_draft('catalog-game', '94000000-0000-0000-0000-000000000001');
select is((select catalog_status from public.list_game_catalog('94000000-0000-0000-0000-000000000001')), 'published', 'catalog lists published game');
select is(public.archive_published_game('catalog-game', '94000000-0000-0000-0000-000000000001'), 1, 'admin archives active versions');
select is((select catalog_status from public.list_game_catalog('94000000-0000-0000-0000-000000000001')), 'archived', 'catalog reports archived state');
select is((select archived_by from public.published_game_versions where game_id='catalog-game'), '94000000-0000-0000-0000-000000000001'::uuid, 'archive actor recorded');
select throws_ok(
  $$select public.archive_published_game('catalog-game', '94000000-0000-0000-0000-000000000001')$$,
  'active published game not found', 'already archived game cannot be archived twice');
select throws_ok(
  $$select * from public.list_game_catalog('94000000-0000-0000-0000-000000000002')$$,
  'content admin required', 'service route cannot list for non-admin');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.published_game_versions), 0::bigint, 'family cannot read archived game');
select ok(not has_function_privilege('authenticated', 'public.list_game_catalog(uuid)', 'execute'), 'browser cannot list private catalog');
select ok(not has_function_privilege('authenticated', 'public.archive_published_game(text,uuid)', 'execute'), 'browser cannot archive games');
reset role;

select * from finish();
rollback;
