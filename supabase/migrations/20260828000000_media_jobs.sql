create table private.media_jobs (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  scene_id text,
  provider text not null,
  mode text not null check (mode in ('local_animation', 'static_image')),
  -- Normalized scene/media spec computed by admin-web's schemaAdapter.ts at
  -- job-creation time (apps/admin-web/src/lib/media/types.ts MediaGenerationInput).
  -- The worker only ever reads this -- it never reinterprets story/scene content,
  -- keeping content/pedagogy decisions on the TypeScript side.
  render_manifest jsonb not null,
  status text not null default 'queued' check (status in (
    'queued', 'generating_audio', 'planning_scenes', 'generating_visuals',
    'rendering', 'uploading', 'ready', 'failed'
  )),
  progress integer not null default 0 check (progress between 0 and 100),
  asset_url text,
  error text,
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_jobs_status_idx on private.media_jobs (status, created_at);

revoke all on private.media_jobs from public, anon, authenticated;

create or replace function public.create_media_job(
  target_story_id text, target_scene_id text, target_provider text, target_mode text,
  target_render_manifest jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare new_id uuid; current_admin uuid := auth.uid();
begin
  if not private.is_content_admin(current_admin) then raise exception 'content admin required'; end if;
  if target_mode not in ('local_animation', 'static_image') then raise exception 'invalid mode'; end if;
  if jsonb_typeof(target_render_manifest) <> 'object' then
    raise exception 'render_manifest must be a JSON object';
  end if;
  insert into private.media_jobs (story_id, scene_id, provider, mode, render_manifest, requested_by)
  values (target_story_id, target_scene_id, target_provider, target_mode, target_render_manifest, current_admin)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.list_media_jobs()
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select j.id, j.story_id, j.scene_id, j.provider, j.mode, j.render_manifest, j.status, j.progress,
    j.asset_url, j.error, j.requested_by, j.created_at, j.updated_at
  from private.media_jobs j
  order by j.created_at desc;
end;
$$;

create or replace function public.get_media_job(target_job_id uuid)
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select j.id, j.story_id, j.scene_id, j.provider, j.mode, j.render_manifest, j.status, j.progress,
    j.asset_url, j.error, j.requested_by, j.created_at, j.updated_at
  from private.media_jobs j
  where j.id = target_job_id;
end;
$$;

-- Atomically hands the oldest queued job to a worker (skip locked so a
-- second concurrent worker never double-claims). Marks it in-flight so it
-- drops out of future queued scans immediately.
create or replace function public.claim_next_media_job()
returns table (
  id uuid, story_id text, scene_id text, provider text, mode text, render_manifest jsonb,
  status text, progress integer, asset_url text, error text,
  requested_by uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare claimed_id uuid;
begin
  -- `<>` against NULL is NULL, not TRUE -- an unauthenticated caller (no
  -- request.jwt.claim.role at all) would silently pass an `<>` check.
  -- `IS DISTINCT FROM` treats NULL as "not service_role" correctly.
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  -- Bare column names here would be ambiguous against this function's own
  -- OUT/return-table columns of the same name (e.g. "status"), so every
  -- reference below is qualified with the `m` table alias.
  select m.id into claimed_id from private.media_jobs m
    where m.status = 'queued'
    order by m.created_at asc
    for update skip locked
    limit 1;
  if claimed_id is null then return; end if;
  return query
  update private.media_jobs m set status = 'generating_audio', updated_at = now()
    where m.id = claimed_id
    returning m.id, m.story_id, m.scene_id, m.provider, m.mode, m.render_manifest, m.status,
      m.progress, m.asset_url, m.error, m.requested_by, m.created_at, m.updated_at;
end;
$$;

create or replace function public.update_media_job_status(
  target_job_id uuid, new_status text, new_progress integer default null,
  new_asset_url text default null, new_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- `<>` against NULL is NULL, not TRUE -- an unauthenticated caller (no
  -- request.jwt.claim.role at all) would silently pass an `<>` check.
  -- `IS DISTINCT FROM` treats NULL as "not service_role" correctly.
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if new_status not in (
    'queued', 'generating_audio', 'planning_scenes', 'generating_visuals',
    'rendering', 'uploading', 'ready', 'failed'
  ) then raise exception 'invalid status'; end if;
  update private.media_jobs set
    status = new_status,
    progress = coalesce(new_progress, progress),
    asset_url = coalesce(new_asset_url, asset_url),
    error = new_error,
    updated_at = now()
  where id = target_job_id;
  if not found then raise exception 'media job not found'; end if;
end;
$$;

grant execute on function public.create_media_job(text, text, text, text, jsonb) to authenticated;
grant execute on function public.list_media_jobs() to authenticated;
grant execute on function public.get_media_job(uuid) to authenticated;

revoke all on function public.claim_next_media_job() from public, anon, authenticated;
grant execute on function public.claim_next_media_job() to service_role;
revoke all on function public.update_media_job_status(uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.update_media_job_status(uuid, text, integer, text, text)
  to service_role;

comment on table private.media_jobs is
  'Async media-generation jobs (admin-web creates via create_media_job; media-worker
   claims/updates via service_role-only RPCs). Mirrors apps/admin-web/src/lib/media/types.ts
   MediaJob and services/media-worker/media_worker/render_manifest.py MediaJobStatus.';
