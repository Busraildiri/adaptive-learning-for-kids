create or replace function public.record_content_generation_run(
  source_request_id text,
  generated_story_id text,
  run_status text,
  generator_model_name text,
  supervisor_model_name text,
  generation_prompt_hash text,
  generation_schema_version text,
  generation_safety_rules_version text,
  generation_guidance_version text,
  generation_rejection_reasons jsonb,
  generated_story jsonb default null,
  generated_story_version integer default null,
  generated_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  insert into private.content_generation_runs (
    request_id,
    story_id,
    status,
    generator_model,
    supervisor_model,
    prompt_hash,
    schema_version,
    safety_rules_version,
    guidance_version,
    rejection_reasons,
    generated_story,
    generated_story_version,
    created_at
  ) values (
    source_request_id,
    generated_story_id,
    run_status,
    generator_model_name,
    supervisor_model_name,
    generation_prompt_hash,
    generation_schema_version,
    generation_safety_rules_version,
    generation_guidance_version,
    generation_rejection_reasons,
    generated_story,
    generated_story_version,
    generated_at
  );
end;
$$;

revoke all on function public.record_content_generation_run(
  text, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_content_generation_run(
  text, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, timestamptz
) to service_role;

comment on function public.record_content_generation_run(
  text, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, timestamptz
) is 'Server-only append operation for audited content generation before publication routing.';
