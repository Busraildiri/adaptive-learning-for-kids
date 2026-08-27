create table private.parent_session_summary_audit (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  status text not null check (
    status in ('consent_required', 'no_activity', 'insufficient_data', 'ready')
  ),
  completed_session_count integer not null check (completed_session_count >= 0),
  eligible_session_count integer not null check (eligible_session_count >= 0),
  observation_code text check (
    observation_code is null
    or observation_code in ('continued_participation', 'varied_participation')
  ),
  policy_version text not null,
  generated_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index parent_session_summary_audit_child_idx
on private.parent_session_summary_audit (child_id, generated_at desc);

create function public.get_parent_session_summary(child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  consent_enabled boolean;
  completed_count integer := 0;
  eligible_count integer := 0;
  distinct_activity_count integer := 0;
  recent_sessions jsonb := '[]'::jsonb;
  resolved_status text;
  observation_code text;
  observation_text text;
  generated_at timestamptz := now();
  policy_version constant text := 'parent-insight-policy-v1';
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.child_profiles
    where id = child_profile_id and parent_id = current_parent_id
  ) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;

  select coalesce(bool_or(enabled), false)
  into consent_enabled
  from public.child_consent_preferences
  where child_id = child_profile_id
    and parent_id = current_parent_id
    and consent_type = 'learning_observations';

  if consent_enabled then
    with completed_sessions as (
      select
        event.session_id,
        min(event.activity_id) as activity_id,
        max(event.occurred_at) filter (where event.event_type = 'activity_completed') as completed_at
      from private.interaction_events as event
      where event.child_id = child_profile_id
        and event.parent_id = current_parent_id
      group by event.session_id
      having bool_or(event.event_type = 'activity_completed')
    ), recent as (
      select session_id, activity_id, completed_at
      from completed_sessions
      order by completed_at desc
      limit 5
    )
    select
      (select count(*) from completed_sessions),
      (select count(distinct activity_id) from completed_sessions),
      coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'sessionId', session_id,
            'activityId', activity_id,
            'completedAt', completed_at
          ) order by completed_at desc
        ) from recent),
        '[]'::jsonb
      )
    into completed_count, distinct_activity_count, recent_sessions;

    select count(*)
    into eligible_count
    from private.learning_evidence
    where child_id = child_profile_id
      and parent_id = current_parent_id
      and classification in ('valid_evidence', 'limited_evidence');
  end if;

  if not consent_enabled then
    resolved_status := 'consent_required';
    completed_count := 0;
    eligible_count := 0;
    recent_sessions := '[]'::jsonb;
  elsif completed_count = 0 then
    resolved_status := 'no_activity';
  elsif eligible_count < 3 then
    resolved_status := 'insufficient_data';
  else
    resolved_status := 'ready';
    if distinct_activity_count >= 2 then
      observation_code := 'varied_participation';
      observation_text := 'Son oturumlarda birden fazla hikâyeye katıldı.';
    else
      observation_code := 'continued_participation';
      observation_text := 'Son oturumlarda hikâyeyi tamamlamaya devam etti.';
    end if;
  end if;

  insert into private.parent_session_summary_audit (
    parent_id,
    child_id,
    status,
    completed_session_count,
    eligible_session_count,
    observation_code,
    policy_version,
    generated_at
  ) values (
    current_parent_id,
    child_profile_id,
    resolved_status,
    completed_count,
    eligible_count,
    observation_code,
    policy_version,
    generated_at
  );

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', resolved_status,
    'childId', child_profile_id,
    'completedSessionCount', completed_count,
    'eligibleSessionCount', eligible_count,
    'recentSessions', recent_sessions,
    'observation', case when observation_code is null then null else jsonb_build_object(
      'code', observation_code,
      'text', observation_text
    ) end,
    'generatedAt', generated_at,
    'policyVersion', policy_version
  );
end;
$$;

revoke all on table private.parent_session_summary_audit from public, anon, authenticated;
revoke all on function public.get_parent_session_summary(uuid) from public, anon;
grant execute on function public.get_parent_session_summary(uuid) to authenticated;

comment on table private.parent_session_summary_audit is
  'Append-only eligibility and template audit for parent-facing summaries; contains no raw choices.';
comment on function public.get_parent_session_summary(uuid) is
  'Returns a consent-gated, non-diagnostic parent summary without raw interaction payloads.';
