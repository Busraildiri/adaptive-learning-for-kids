begin;
select plan(9);

select has_table('private', 'content_generation_runs', 'content generation audit table exists');
select has_table('private', 'approved_story_versions', 'approved fallback table exists');

select throws_ok(
  $$insert into private.content_generation_runs (
      request_id, story_id, status, generator_model, supervisor_model, prompt_hash,
      schema_version, safety_rules_version, guidance_version, rejection_reasons
    ) values (
      'published-run', 'story-a', 'published', 'g', 's', 'hash', 'schema-v1',
      'safety-v1', 'guide-v1', '[]'::jsonb
    )$$,
  '23514',
  null,
  'agent audit cannot claim published status'
);

insert into private.content_generation_runs (
  request_id, story_id, status, generator_model, supervisor_model, prompt_hash,
  schema_version, safety_rules_version, guidance_version, rejection_reasons,
  generated_story, generated_story_version
) values (
  'draft-run', 'story-a', 'draft', 'generator-v1', 'supervisor-v1', 'fnv1a-abcd',
  'content-agent-v1', 'story-safety-tr-v1', 'guide-v1', '[]'::jsonb,
  '{"id":"story-a"}'::jsonb, 2
);

select throws_ok(
  $$update private.content_generation_runs set generator_model = 'changed' where request_id = 'draft-run'$$,
  'P0001',
  'content audit records are append-only',
  'generation audit cannot be changed'
);

select throws_ok(
  $$delete from private.content_generation_runs where request_id = 'draft-run'$$,
  'P0001',
  'content audit records are append-only',
  'generation audit cannot be deleted'
);

set local role authenticated;
select throws_ok(
  $$select * from private.content_generation_runs$$,
  '42501',
  null,
  'authenticated clients cannot read generation audit'
);
select throws_ok(
  $$select * from private.approved_story_versions$$,
  '42501',
  null,
  'authenticated clients cannot read approved fallback storage directly'
);
select throws_ok(
  $$insert into private.content_generation_runs (
      request_id, story_id, status, generator_model, supervisor_model, prompt_hash,
      schema_version, safety_rules_version, guidance_version, rejection_reasons
    ) values (
      'client-run', 'story-a', 'rejected', 'g', 's', 'hash', 'schema-v1',
      'safety-v1', 'guide-v1', '["invalid_schema"]'::jsonb
    )$$,
  '42501',
  null,
  'authenticated clients cannot create generation runs'
);

reset role;
select results_eq(
  $$select status from private.content_generation_runs where request_id = 'draft-run'$$,
  $$values ('draft'::text)$$,
  'valid draft audit remains stored'
);

select * from finish();
rollback;
