begin;
set local search_path = public, extensions;
select plan(10);

select has_table('private', 'ai_video_character_names', 'AI character-name registry exists');
select has_table('private', 'ai_video_story_requests', 'AI video request table exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('98000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ai-video-admin@example.test', '');
insert into private.content_admins(user_id)
values ('98000000-0000-0000-0000-000000000001');

select is(
  private.normalize_ai_character_name('Mırmır'),
  'mirmir',
  'Turkish dotless-i spelling is normalized'
);
select is(
  private.normalize_ai_character_name('MIRMIR'),
  'mirmir',
  'ASCII spelling variant resolves to the same identity'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table first_request as
select public.create_ai_video_story_request(
  '98000000-0000-0000-0000-000000000001',
  'Mor tasmalı turuncu ve yuvarlak yüzlü yavru bir kedi oluştur.',
  'Parkta kırmızı balonla oynarken balonu patlasın ve üzgün kalsın.',
  '["Mirmir","Pırıl","Cino","Lupi","Moki","Sufi","Teko","Vadi"]'::jsonb,
  '{"title":"{{characterName}} ve Balon","intro":{"narration":"{{characterName}} oynuyor."}}'::jsonb
) as result;

select is(
  (select result ->> 'characterName' from first_request),
  'Pırıl',
  'already-used Mırmır spelling variant is skipped atomically'
);
select ok(
  (select result -> 'plan' ->> 'title' from first_request) = 'Pırıl ve Balon'
  and position('{{characterName}}' in (select result -> 'plan' from first_request)::text) = 0,
  'reserved name replaces every plan token'
);

create temporary table second_request as
select public.create_ai_video_story_request(
  '98000000-0000-0000-0000-000000000001',
  'Mor tasmalı turuncu ve yuvarlak yüzlü yavru bir kedi oluştur.',
  'Parkta kırmızı balonla oynarken balonu patlasın ve üzgün kalsın.',
  '["Mirmir","Pırıl","Cino","Lupi","Moki","Sufi","Teko","Vadi"]'::jsonb,
  '{"title":"{{characterName}} ve Balon","intro":{"narration":"{{characterName}} oynuyor."}}'::jsonb
) as result;

select is(
  (select result ->> 'characterName' from second_request),
  'Cino',
  'a name reserved by an earlier generation is never reused'
);
select isnt(
  (select result ->> 'storyId' from first_request),
  (select result ->> 'storyId' from second_request),
  'each generated story has a unique id'
);

reset role;
select is(
  (select count(*)::bigint from private.ai_video_story_requests),
  2::bigint,
  'both prompt-driven requests are stored'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '98000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.list_ai_video_character_names('98000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'name inventory is server-only'
);

select * from finish();
rollback;
