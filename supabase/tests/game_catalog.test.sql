begin;
select plan(29);

select has_column('public', 'published_game_versions', 'archived_at', 'published game archive timestamp exists');
select has_column('public', 'published_game_versions', 'archived_by', 'publishing admin archive actor exists');
select has_table('public', 'game_catalog_tombstones', 'deleted game fallback tombstones exist');

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
reset role;
select is((select archived_by from public.published_game_versions where game_id='catalog-game'), '94000000-0000-0000-0000-000000000001'::uuid, 'archive actor recorded');
set local role service_role;
select throws_ok(
  $$select public.archive_published_game('catalog-game', '94000000-0000-0000-0000-000000000001')$$,
  'active published game not found', 'already archived game cannot be archived twice');
select is(public.delete_game_catalog_entry('catalog-game', 'archived', '94000000-0000-0000-0000-000000000001'), 1, 'admin permanently deletes an archived game');
reset role;
select is((select count(*) from public.published_game_versions where game_id='catalog-game'), 0::bigint, 'archived game versions are removed');
select is((select count(*) from public.game_catalog_tombstones where game_id='catalog-game'), 1::bigint, 'archived game receives a fallback tombstone');
set local role service_role;
select throws_ok(
  $$select * from public.list_game_catalog('94000000-0000-0000-0000-000000000002')$$,
  'content admin required', 'service route cannot list for non-admin');
select public.save_game_draft('{"id":"delete-draft-game","version":1,"status":"draft","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '94000000-0000-0000-0000-000000000001');
select is(public.delete_game_draft('delete-draft-game', '94000000-0000-0000-0000-000000000001'), 1, 'admin deletes a draft');
reset role;
select is((select count(*) from private.game_drafts where game_id='delete-draft-game'), 0::bigint, 'deleted draft is removed');
set local role service_role;
select throws_ok(
  $$select public.delete_game_draft('delete-draft-game', '94000000-0000-0000-0000-000000000001')$$,
  'game draft not found', 'missing draft cannot be deleted twice');
select public.save_game_draft('{"id":"delete-published-game","version":1,"status":"draft","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '94000000-0000-0000-0000-000000000001');
select public.publish_game_draft('delete-published-game', '94000000-0000-0000-0000-000000000001');
select is(public.delete_game_catalog_entry('delete-published-game', 'published', '94000000-0000-0000-0000-000000000001'), 1, 'admin permanently deletes a published game');
reset role;
select is((select count(*) from public.published_game_versions where game_id='delete-published-game'), 0::bigint, 'published game versions are removed');
select is((select count(*) from public.game_catalog_tombstones where game_id='delete-published-game'), 1::bigint, 'published game receives a fallback tombstone');
set local role service_role;
select public.save_game_draft('{"id":"delete-published-game","version":1,"status":"draft","ageBand":"2-4","schemaVersion":"game-v1","mechanic":"tap_or_wait"}', '94000000-0000-0000-0000-000000000001');
select public.publish_game_draft('delete-published-game', '94000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*) from public.game_catalog_tombstones where game_id='delete-published-game'), 0::bigint, 'republishing clears the fallback tombstone');
select is((select count(*) from public.published_game_versions where game_id='delete-published-game'), 1::bigint, 'republished game becomes active again');
select ok(has_function_privilege('service_role', 'public.delete_game_catalog_entry(text,text,uuid)', 'execute'), 'service role can delete catalog games');

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.published_game_versions where game_id='catalog-game'), 0::bigint, 'family cannot read deleted archived game');
select is((select count(game_id) from public.game_catalog_tombstones where game_id='catalog-game'), 1::bigint, 'family can suppress a deleted bundled fallback');
select ok(not has_function_privilege('authenticated', 'public.list_game_catalog(uuid)', 'execute'), 'browser cannot list private catalog');
select ok(not has_function_privilege('authenticated', 'public.archive_published_game(text,uuid)', 'execute'), 'browser cannot archive games');
select ok(not has_function_privilege('authenticated', 'public.delete_game_draft(text,uuid)', 'execute'), 'browser cannot delete drafts');
select ok(not has_function_privilege('authenticated', 'public.delete_game_catalog_entry(text,text,uuid)', 'execute'), 'browser cannot delete catalog games');
select ok(not has_table_privilege('authenticated', 'public.game_catalog_tombstones', 'insert'), 'browser cannot create deletion tombstones');
reset role;

select * from finish();
rollback;
