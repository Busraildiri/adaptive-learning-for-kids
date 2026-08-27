create table private.personalized_activity_decision_log (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  selected_activity_id text not null,
  candidate_activity_ids text[] not null,
  reason_code text not null check (
    reason_code in (
      'personalization_disabled',
      'observations_disabled',
      'insufficient_distinct_activities',
      'consistent_help_preference',
      'repeated_activity_preference',
      'general_rotation'
    )
  ),
  explanation text not null,
  personalized boolean not null,
  eligible_distinct_activity_count integer not null check (eligible_distinct_activity_count >= 0),
  supporting_session_count integer not null check (supporting_session_count >= 0),
  policy_version text not null,
  decided_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index personalized_activity_decision_child_idx
on private.personalized_activity_decision_log (child_id, decided_at desc);

create function public.select_personalized_activity(
  child_profile_id uuid,
  candidate_activity_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  personalization_enabled boolean := false;
  observations_enabled boolean := false;
  eligible_distinct_count integer := 0;
  selected_id text;
  resolved_reason text;
  resolved_explanation text;
  resolved_personalized boolean := false;
  supporting_count integer := 0;
  policy_version constant text := 'personalization-policy-v1';
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if cardinality(candidate_activity_ids) not between 1 and 100
    or exists (
      select 1 from unnest(candidate_activity_ids) as id
      where char_length(id) not between 1 and 100
    ) then
    raise exception 'Candidate activities are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.child_profiles
    where id = child_profile_id and parent_id = current_parent_id
  ) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;

  select
    coalesce(bool_or(enabled) filter (where consent_type = 'personalization'), false),
    coalesce(bool_or(enabled) filter (where consent_type = 'learning_observations'), false)
  into personalization_enabled, observations_enabled
  from public.child_consent_preferences
  where child_id = child_profile_id and parent_id = current_parent_id;

  select count(distinct activity_id)
  into eligible_distinct_count
  from private.learning_evidence
  where child_id = child_profile_id
    and parent_id = current_parent_id
    and classification in ('valid_evidence', 'limited_evidence');

  with candidates as (
    select id, ordinal
    from unnest(candidate_activity_ids) with ordinality as candidate(id, ordinal)
  ), stats as (
    select
      candidate.id,
      candidate.ordinal,
      count(distinct evidence.session_id) filter (
        where evidence.classification in ('valid_evidence', 'limited_evidence')
      ) as completion_count,
      max(evidence.derived_at) filter (
        where evidence.classification in ('valid_evidence', 'limited_evidence')
      ) as last_completed_at,
      (
        select count(distinct started.session_id)
        from private.interaction_events as started
        where started.child_id = child_profile_id
          and started.parent_id = current_parent_id
          and started.activity_id = candidate.id
          and started.event_type = 'activity_started'
      ) as start_session_count,
      coalesce((
        select max(help_count)
        from (
          select count(distinct help.session_id) as help_count
          from private.interaction_events as help
          where help.child_id = child_profile_id
            and help.parent_id = current_parent_id
            and help.activity_id = candidate.id
            and help.event_type = 'hint_requested'
            and help.payload ? 'action'
          group by help.payload ->> 'action'
        ) as help_counts
      ), 0) as consistent_help_count
    from candidates as candidate
    left join private.learning_evidence as evidence
      on evidence.child_id = child_profile_id
      and evidence.parent_id = current_parent_id
      and evidence.activity_id = candidate.id
    group by candidate.id, candidate.ordinal
  )
  select id
  into selected_id
  from stats
  order by completion_count, last_completed_at nulls first, ordinal
  limit 1;

  if not personalization_enabled then
    resolved_reason := 'personalization_disabled';
    resolved_explanation := 'Kişiselleştirme kapalı olduğu için genel hikâye sırası kullanılıyor.';
  elsif not observations_enabled then
    resolved_reason := 'observations_disabled';
    resolved_explanation := 'Öğrenme gözlemleri kapalı olduğu için genel hikâye sırası kullanılıyor.';
  elsif eligible_distinct_count < 5 then
    resolved_reason := 'insufficient_distinct_activities';
    resolved_explanation := 'Beş farklı hikâye tamamlanana kadar genel hikâye sırası kullanılıyor.';
  else
    with candidates as (
      select id, ordinal
      from unnest(candidate_activity_ids) with ordinality as candidate(id, ordinal)
    ), help_stats as (
      select
        candidate.id,
        candidate.ordinal,
        coalesce(max(help_count), 0) as supporting_count
      from candidates as candidate
      left join lateral (
        select count(distinct help.session_id) as help_count
        from private.interaction_events as help
        where help.child_id = child_profile_id
          and help.parent_id = current_parent_id
          and help.activity_id = candidate.id
          and help.event_type = 'hint_requested'
          and help.payload ? 'action'
        group by help.payload ->> 'action'
      ) as per_action on true
      group by candidate.id, candidate.ordinal
    )
    select id, help_stats.supporting_count
    into selected_id, supporting_count
    from help_stats
    where help_stats.supporting_count >= 2
    order by help_stats.supporting_count desc, ordinal
    limit 1;

    if found then
      resolved_reason := 'consistent_help_preference';
      resolved_explanation := 'Birden fazla oturumda benzer yardım tercihi görülen bir hikâye öne çıkarıldı.';
      resolved_personalized := true;
    else
      with candidates as (
        select id, ordinal
        from unnest(candidate_activity_ids) with ordinality as candidate(id, ordinal)
      ), repeat_stats as (
        select
          candidate.id,
          candidate.ordinal,
          count(distinct started.session_id) as supporting_count
        from candidates as candidate
        join private.interaction_events as started
          on started.child_id = child_profile_id
          and started.parent_id = current_parent_id
          and started.activity_id = candidate.id
          and started.event_type = 'activity_started'
        where exists (
          select 1 from private.learning_evidence as evidence
          where evidence.child_id = child_profile_id
            and evidence.parent_id = current_parent_id
            and evidence.activity_id = candidate.id
            and evidence.classification in ('valid_evidence', 'limited_evidence')
        )
        group by candidate.id, candidate.ordinal
      )
      select id, repeat_stats.supporting_count
      into selected_id, supporting_count
      from repeat_stats
      where repeat_stats.supporting_count >= 2
      order by repeat_stats.supporting_count desc, ordinal
      limit 1;

      if found then
        resolved_reason := 'repeated_activity_preference';
        resolved_explanation := 'Birden fazla oturumda yeniden seçilen bir hikâye öne çıkarıldı.';
        resolved_personalized := true;
      else
        resolved_reason := 'general_rotation';
        resolved_explanation := 'Tutarlı bir tercih oluşmadığı için genel hikâye sırası kullanılıyor.';
        supporting_count := 0;
      end if;
    end if;
  end if;

  insert into private.personalized_activity_decision_log (
    parent_id,
    child_id,
    selected_activity_id,
    candidate_activity_ids,
    reason_code,
    explanation,
    personalized,
    eligible_distinct_activity_count,
    supporting_session_count,
    policy_version
  ) values (
    current_parent_id,
    child_profile_id,
    selected_id,
    candidate_activity_ids,
    resolved_reason,
    resolved_explanation,
    resolved_personalized,
    eligible_distinct_count,
    supporting_count,
    policy_version
  );

  return jsonb_build_object(
    'selectedActivityId', selected_id,
    'reasonCode', resolved_reason,
    'explanation', resolved_explanation,
    'policyVersion', policy_version,
    'personalized', resolved_personalized,
    'eligibleDistinctActivityCount', eligible_distinct_count,
    'supportingSessionCount', supporting_count
  );
end;
$$;

create function public.get_parent_personalization_status(child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  personalization_enabled boolean := false;
  observations_enabled boolean := false;
  eligible_distinct_count integer := 0;
  latest_decision record;
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

  select
    coalesce(bool_or(enabled) filter (where consent_type = 'personalization'), false),
    coalesce(bool_or(enabled) filter (where consent_type = 'learning_observations'), false)
  into personalization_enabled, observations_enabled
  from public.child_consent_preferences
  where child_id = child_profile_id and parent_id = current_parent_id;

  select count(distinct activity_id)
  into eligible_distinct_count
  from private.learning_evidence
  where child_id = child_profile_id
    and parent_id = current_parent_id
    and classification in ('valid_evidence', 'limited_evidence');

  select reason_code, explanation, personalized, selected_activity_id, decided_at
  into latest_decision
  from private.personalized_activity_decision_log
  where child_id = child_profile_id and parent_id = current_parent_id
  order by id desc
  limit 1;

  return jsonb_build_object(
    'personalizationEnabled', personalization_enabled,
    'learningObservationsEnabled', observations_enabled,
    'eligibleDistinctActivityCount', eligible_distinct_count,
    'requiredDistinctActivityCount', 5,
    'eligible', personalization_enabled and observations_enabled and eligible_distinct_count >= 5,
    'policyVersion', 'personalization-policy-v1',
    'lastDecision', case when latest_decision.reason_code is null then null else jsonb_build_object(
      'reasonCode', latest_decision.reason_code,
      'explanation', latest_decision.explanation,
      'personalized', latest_decision.personalized,
      'selectedActivityId', latest_decision.selected_activity_id,
      'decidedAt', latest_decision.decided_at
    ) end
  );
end;
$$;

revoke all on table private.personalized_activity_decision_log from public, anon, authenticated;
revoke all on function public.select_personalized_activity(uuid, text[]) from public, anon;
revoke all on function public.get_parent_personalization_status(uuid) from public, anon;
grant execute on function public.select_personalized_activity(uuid, text[]) to authenticated;
grant execute on function public.get_parent_personalization_status(uuid) to authenticated;

comment on table private.personalized_activity_decision_log is
  'Append-only, consent-gated recommendation decisions without child traits, scores, or diagnoses.';
comment on function public.select_personalized_activity(uuid, text[]) is
  'Selects a story using repeated multi-session signals only after five distinct eligible activities.';
