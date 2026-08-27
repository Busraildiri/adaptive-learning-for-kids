create table private.content_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.content_review_queue (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique references private.content_generation_runs(request_id),
  story_id text not null,
  story_version integer not null check (story_version > 0),
  content_version text not null check (content_version ~ '^\d+\.\d+\.\d+$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  suspicion_reasons jsonb not null check (
    jsonb_typeof(suspicion_reasons) = 'array' and jsonb_array_length(suspicion_reasons) > 0
  ),
  story jsonb,
  queued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 days'),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  constraint content_review_queue_state_consistent check (
    (status = 'pending' and story is not null and decided_at is null and decided_by is null)
    or (status = 'approved' and story is not null and decided_at is not null and decided_by is not null)
    or (status = 'rejected' and story is null and decided_at is not null and decided_by is not null)
    or (status = 'expired' and story is null and decided_at is not null and decided_by is null)
  )
);

create index content_review_queue_pending_idx
on private.content_review_queue (expires_at, queued_at)
where status = 'pending';

create table private.content_review_decisions (
  id bigint generated always as identity primary key,
  queue_id uuid not null references private.content_review_queue(id),
  request_id text not null,
  decision text not null check (decision in ('approved', 'rejected', 'expired')),
  reason text check (reason is null or char_length(reason) between 1 and 500),
  actor_id uuid references auth.users(id),
  decided_at timestamptz not null default now()
);

create table public.published_story_versions (
  story_id text not null,
  story_version integer not null check (story_version > 0),
  content_version text not null check (content_version ~ '^\d+\.\d+\.\d+$'),
  story jsonb not null,
  source_request_id text not null unique,
  published_at timestamptz not null default now(),
  primary key (story_id, story_version)
);

alter table public.published_story_versions enable row level security;
revoke all on private.content_admins from public, anon, authenticated;
revoke all on private.content_review_queue from public, anon, authenticated;
revoke all on private.content_review_decisions from public, anon, authenticated;
revoke all on public.published_story_versions from anon, authenticated;
grant select on public.published_story_versions to authenticated;

create policy "Signed-in families can read published stories"
on public.published_story_versions for select to authenticated using (true);

create or replace function private.is_content_admin(candidate uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.content_admins where user_id = candidate); $$;

create or replace function public.is_content_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_content_admin(auth.uid()); $$;

create or replace function public.list_content_review_queue()
returns table (
  id uuid, request_id text, story_id text, story_version integer, content_version text,
  status text, suspicion_reasons jsonb, story jsonb, queued_at timestamptz,
  expires_at timestamptz, decided_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_content_admin(auth.uid()) then raise exception 'content admin required'; end if;
  return query
  select q.id, q.request_id, q.story_id, q.story_version, q.content_version, q.status,
    q.suspicion_reasons, q.story, q.queued_at, q.expires_at, q.decided_at
  from private.content_review_queue q
  order by (q.status = 'pending') desc, q.expires_at asc, q.queued_at desc;
end;
$$;

create or replace function public.decide_content_review(
  target_queue_id uuid, requested_decision text, decision_reason text default null
)
returns text language plpgsql security definer set search_path = ''
as $$
declare q private.content_review_queue%rowtype; current_admin uuid := auth.uid();
begin
  if not private.is_content_admin(current_admin) then raise exception 'content admin required'; end if;
  if requested_decision not in ('approved', 'rejected') then raise exception 'invalid decision'; end if;
  select * into q from private.content_review_queue where id = target_queue_id for update;
  if not found then raise exception 'review item not found'; end if;
  if q.status <> 'pending' then raise exception 'review item is no longer pending'; end if;
  if q.expires_at <= now() then raise exception 'review item has expired'; end if;

  if requested_decision = 'approved' then
    insert into public.published_story_versions
      (story_id, story_version, content_version, story, source_request_id)
    values (q.story_id, q.story_version, q.content_version, q.story, q.request_id);
    insert into private.approved_story_versions
      (story_id, story_version, content_version, story, approved_by)
    values (q.story_id, q.story_version, q.content_version, q.story, current_admin);
    update private.content_review_queue set status = 'approved', decided_at = now(),
      decided_by = current_admin where id = q.id;
  else
    update private.content_review_queue set status = 'rejected', story = null,
      decided_at = now(), decided_by = current_admin where id = q.id;
  end if;

  insert into private.content_review_decisions
    (queue_id, request_id, decision, reason, actor_id)
  values (q.id, q.request_id, requested_decision, nullif(trim(decision_reason), ''), current_admin);
  return requested_decision;
end;
$$;

create or replace function public.submit_generated_story(
  source_request_id text, generated_story jsonb, generated_content_version text,
  confidence double precision, suspicion_reasons jsonb default '[]'::jsonb,
  review_expires_at timestamptz default (now() + interval '15 days')
)
returns text language plpgsql security definer set search_path = ''
as $$
declare run private.content_generation_runs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if confidence < 0 or confidence > 1 then raise exception 'confidence must be between 0 and 1'; end if;
  if jsonb_typeof(suspicion_reasons) <> 'array' then raise exception 'suspicion reasons must be an array'; end if;
  select * into run from private.content_generation_runs where request_id = source_request_id;
  if not found or run.status <> 'draft' then raise exception 'publishable generation run required'; end if;
  if generated_story is distinct from run.generated_story then raise exception 'story does not match audited draft'; end if;

  if confidence < 0.9 or jsonb_array_length(suspicion_reasons) > 0 then
    if jsonb_array_length(suspicion_reasons) = 0 then suspicion_reasons := '["low_confidence"]'::jsonb; end if;
    insert into private.content_review_queue
      (request_id, story_id, story_version, content_version, suspicion_reasons, story, expires_at)
    values (run.request_id, run.story_id, run.generated_story_version,
      generated_content_version, suspicion_reasons, generated_story, review_expires_at);
    return 'queued_for_review';
  end if;

  insert into public.published_story_versions
    (story_id, story_version, content_version, story, source_request_id)
  values (run.story_id, run.generated_story_version, generated_content_version,
    generated_story, run.request_id);
  return 'published';
end;
$$;

create or replace function private.expire_content_review_queue(reference_time timestamptz default now())
returns integer language plpgsql security definer set search_path = ''
as $$
declare expired_count integer;
begin
  with expired as (
    update private.content_review_queue set status = 'expired', story = null,
      decided_at = reference_time
    where status = 'pending' and expires_at <= reference_time
    returning id, request_id
  ), logged as (
    insert into private.content_review_decisions (queue_id, request_id, decision, reason)
    select id, request_id, 'expired', '15_day_retention_elapsed' from expired returning 1
  ) select count(*) into expired_count from logged;
  return expired_count;
end;
$$;

grant execute on function public.is_content_admin() to authenticated;
grant execute on function public.list_content_review_queue() to authenticated;
grant execute on function public.decide_content_review(uuid, text, text) to authenticated;
revoke all on function public.submit_generated_story(text, jsonb, text, double precision, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_generated_story(text, jsonb, text, double precision, jsonb, timestamptz)
  to service_role;
revoke all on function private.is_content_admin(uuid) from public, anon, authenticated;
revoke all on function private.expire_content_review_queue(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'expire-content-review-queue', '17 * * * *',
      'select private.expire_content_review_queue();'
    );
  end if;
exception when unique_violation then null;
end;
$$;

comment on table private.content_review_queue is
  'R9 suspicious-content queue. Rejected and expired story bodies are physically erased.';
comment on function private.expire_content_review_queue(timestamptz) is
  'Deletes pending story bodies after the 15-day review window; scheduled hourly with pg_cron.';
