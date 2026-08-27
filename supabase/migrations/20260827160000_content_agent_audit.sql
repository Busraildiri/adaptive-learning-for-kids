create table private.content_generation_runs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  story_id text not null,
  status text not null check (status in ('draft', 'rejected')),
  generator_model text not null,
  supervisor_model text not null,
  prompt_hash text not null,
  schema_version text not null,
  safety_rules_version text not null,
  guidance_version text not null,
  rejection_reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(rejection_reasons) = 'array'),
  generated_story jsonb,
  generated_story_version integer check (generated_story_version is null or generated_story_version > 0),
  created_at timestamptz not null default now(),
  constraint content_generation_result_consistent check (
    (status = 'draft' and generated_story is not null and generated_story_version is not null
      and jsonb_array_length(rejection_reasons) = 0)
    or
    (status = 'rejected' and generated_story is null and generated_story_version is null
      and jsonb_array_length(rejection_reasons) > 0)
  )
);

create table private.approved_story_versions (
  story_id text not null,
  story_version integer not null check (story_version > 0),
  content_version text not null check (content_version ~ '^\d+\.\d+\.\d+$'),
  story jsonb not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz not null default now(),
  primary key (story_id, story_version)
);

create or replace function private.reject_content_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'content audit records are append-only';
end;
$$;

create trigger content_generation_runs_append_only
before update or delete on private.content_generation_runs
for each row execute function private.reject_content_audit_mutation();

create trigger approved_story_versions_append_only
before update or delete on private.approved_story_versions
for each row execute function private.reject_content_audit_mutation();

revoke all on private.content_generation_runs from anon, authenticated;
revoke all on private.approved_story_versions from anon, authenticated;
revoke all on function private.reject_content_audit_mutation() from public, anon, authenticated;

comment on table private.content_generation_runs is
  'Append-only R8 audit log. The content agent can create only draft or rejected results.';
comment on table private.approved_story_versions is
  'Append-only expert/admin-approved stories used as the safe runtime fallback.';
