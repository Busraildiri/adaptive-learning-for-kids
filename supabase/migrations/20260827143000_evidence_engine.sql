create table private.evidence_threshold_configs (
  version text primary key check (char_length(version) between 1 and 40),
  minimum_response_ms integer not null check (minimum_response_ms between 0 and 60000),
  minimum_distinct_responses integer not null check (minimum_distinct_responses between 1 and 20),
  maximum_duplicate_ratio numeric not null check (maximum_duplicate_ratio between 0 and 1),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index evidence_threshold_configs_one_active_idx
on private.evidence_threshold_configs (active)
where active;

insert into private.evidence_threshold_configs (
  version,
  minimum_response_ms,
  minimum_distinct_responses,
  maximum_duplicate_ratio,
  active
)
values ('evidence-thresholds-v1', 700, 2, 0.6, true);

create table private.learning_evidence (
  session_id uuid primary key,
  parent_id uuid not null,
  child_id uuid not null,
  activity_id text not null,
  classification text not null check (
    classification in ('valid_evidence', 'limited_evidence', 'interaction_noise', 'not_evaluated')
  ),
  reason_code text not null check (
    reason_code in (
      'completed_with_multiple_responses',
      'completed_with_limited_responses',
      'single_fast_response',
      'duplicate_dominated_interaction',
      'activity_not_completed',
      'no_evaluable_response'
    )
  ),
  distinct_response_count integer not null check (distinct_response_count >= 0),
  duplicate_response_count integer not null check (duplicate_response_count >= 0),
  normalized_responses jsonb not null default '[]'::jsonb check (jsonb_typeof(normalized_responses) = 'array'),
  threshold_version text not null references private.evidence_threshold_configs (version),
  derived_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index learning_evidence_child_activity_idx
on private.learning_evidence (child_id, activity_id, derived_at);

create table private.activity_decision_log (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  selected_activity_id text not null,
  candidate_activity_ids text[] not null,
  reason_code text not null check (
    reason_code in ('unseen_activity', 'least_practiced', 'least_recently_completed', 'consent_fallback')
  ),
  explanation text not null,
  threshold_version text not null references private.evidence_threshold_configs (version),
  decided_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create function private.derive_session_evidence(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row record;
  threshold_row record;
  completed boolean;
  distinct_count integer;
  duplicate_count integer;
  duplicate_ratio numeric;
  first_response_ms integer;
  response_json jsonb;
  resolved_classification text;
  resolved_reason text;
begin
  select parent_id, child_id, activity_id
  into session_row
  from private.interaction_events
  where session_id = target_session_id
  order by sequence_number
  limit 1;

  if not found then return; end if;

  select * into threshold_row
  from private.evidence_threshold_configs
  where active;

  with ordered_choices as (
    select
      event_id,
      sequence_number,
      occurred_at,
      payload ->> 'stepId' as step_id,
      coalesce(payload ->> 'choiceId', payload ->> 'action') as choice_id,
      row_number() over (
        partition by payload ->> 'stepId'
        order by sequence_number
      ) as response_rank
    from private.interaction_events
    where session_id = target_session_id
      and event_type in ('choice_selected', 'hint_requested')
      and payload ? 'stepId'
  ),
  normalized as (
    select
      choice.event_id,
      choice.sequence_number,
      choice.step_id,
      choice.choice_id,
      case when presented.occurred_at is null then null else greatest(
        0, extract(epoch from (choice.occurred_at - presented.occurred_at)) * 1000
      )::integer end as response_ms
    from ordered_choices as choice
    left join lateral (
      select occurred_at
      from private.interaction_events
      where session_id = target_session_id
        and event_type = 'step_presented'
        and payload ->> 'stepId' = choice.step_id
        and sequence_number < choice.sequence_number
      order by sequence_number desc
      limit 1
    ) as presented on true
    where choice.response_rank = 1 and choice.choice_id is not null
  )
  select
    (select count(*) from ordered_choices where response_rank = 1 and choice_id is not null),
    (select count(*) from ordered_choices where response_rank > 1),
    (select response_ms from normalized order by sequence_number limit 1),
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'sourceEventId', event_id,
          'stepId', step_id,
          'choiceId', choice_id,
          'responseMs', response_ms
        ) order by step_id
      ) from normalized),
      '[]'::jsonb
    )
  into distinct_count, duplicate_count, first_response_ms, response_json;

  select exists (
    select 1 from private.interaction_events
    where session_id = target_session_id and event_type = 'activity_completed'
  ) into completed;

  duplicate_ratio := case
    when distinct_count + duplicate_count = 0 then 0
    else duplicate_count::numeric / (distinct_count + duplicate_count)
  end;

  if not completed then
    if duplicate_ratio > threshold_row.maximum_duplicate_ratio then
      resolved_classification := 'interaction_noise';
      resolved_reason := 'duplicate_dominated_interaction';
    else
      resolved_classification := 'not_evaluated';
      resolved_reason := 'activity_not_completed';
    end if;
  elsif distinct_count = 0 then
    resolved_classification := 'not_evaluated';
    resolved_reason := 'no_evaluable_response';
  elsif distinct_count = 1 and first_response_ms is not null
    and first_response_ms < threshold_row.minimum_response_ms then
    resolved_classification := 'limited_evidence';
    resolved_reason := 'single_fast_response';
  elsif distinct_count < threshold_row.minimum_distinct_responses then
    resolved_classification := 'limited_evidence';
    resolved_reason := 'completed_with_limited_responses';
  else
    resolved_classification := 'valid_evidence';
    resolved_reason := 'completed_with_multiple_responses';
  end if;

  insert into private.learning_evidence (
    session_id, parent_id, child_id, activity_id, classification, reason_code,
    distinct_response_count, duplicate_response_count, normalized_responses, threshold_version
  ) values (
    target_session_id, session_row.parent_id, session_row.child_id, session_row.activity_id,
    resolved_classification, resolved_reason, distinct_count, duplicate_count,
    response_json, threshold_row.version
  )
  on conflict (session_id) do update set
    classification = excluded.classification,
    reason_code = excluded.reason_code,
    distinct_response_count = excluded.distinct_response_count,
    duplicate_response_count = excluded.duplicate_response_count,
    normalized_responses = excluded.normalized_responses,
    threshold_version = excluded.threshold_version,
    derived_at = now();
end;
$$;

create function private.refresh_evidence_after_interaction_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.derive_session_evidence(new.session_id);
  return new;
end;
$$;

create trigger interaction_events_refresh_evidence
after insert on private.interaction_events
for each row execute function private.refresh_evidence_after_interaction_event();

create function public.select_next_activity(child_profile_id uuid, candidate_activity_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  selected_id text;
  resolved_reason text;
  resolved_explanation text;
  threshold_version text;
  has_observation_consent boolean;
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if cardinality(candidate_activity_ids) not between 1 and 100
    or exists (select 1 from unnest(candidate_activity_ids) as id where char_length(id) not between 1 and 100) then
    raise exception 'Candidate activities are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.child_profiles
    where id = child_profile_id and parent_id = current_parent_id
  ) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;

  select version into threshold_version
  from private.evidence_threshold_configs where active;
  select exists (
    select 1 from public.child_consent_preferences
    where child_id = child_profile_id
      and parent_id = current_parent_id
      and consent_type = 'learning_observations'
      and enabled
  ) into has_observation_consent;

  if not has_observation_consent then
    selected_id := candidate_activity_ids[1];
    resolved_reason := 'consent_fallback';
    resolved_explanation := 'Öğrenme gözlemi kapalı olduğu için genel içerik sırası kullanıldı.';
  else
    with candidates as (
      select id, ordinal
      from unnest(candidate_activity_ids) with ordinality as candidate(id, ordinal)
    ), stats as (
      select
        candidate.id,
        candidate.ordinal,
        count(evidence.session_id) filter (
          where evidence.classification in ('valid_evidence', 'limited_evidence')
        ) as completion_count,
        max(evidence.derived_at) filter (
          where evidence.classification in ('valid_evidence', 'limited_evidence')
        ) as last_completed_at
      from candidates as candidate
      left join private.learning_evidence as evidence
        on evidence.child_id = child_profile_id
        and evidence.parent_id = current_parent_id
        and evidence.activity_id = candidate.id
      group by candidate.id, candidate.ordinal
    )
    select id,
      case
        when completion_count = 0 then 'unseen_activity'
        when count(*) over (partition by completion_count) > 1 then 'least_recently_completed'
        else 'least_practiced'
      end
    into selected_id, resolved_reason
    from stats
    order by completion_count, last_completed_at nulls first, ordinal
    limit 1;

    resolved_explanation := case resolved_reason
      when 'unseen_activity' then 'Henüz tamamlanmamış bir etkinlik öne çıkarıldı.'
      when 'least_practiced' then 'Daha az tamamlanan bir etkinlik öne çıkarıldı.'
      else 'En uzun süredir tamamlanmayan etkinlik öne çıkarıldı.'
    end;
  end if;

  insert into private.activity_decision_log (
    parent_id, child_id, selected_activity_id, candidate_activity_ids,
    reason_code, explanation, threshold_version
  ) values (
    current_parent_id, child_profile_id, selected_id, candidate_activity_ids,
    resolved_reason, resolved_explanation, threshold_version
  );

  return jsonb_build_object(
    'selectedActivityId', selected_id,
    'reasonCode', resolved_reason,
    'explanation', resolved_explanation,
    'thresholdVersion', threshold_version
  );
end;
$$;

revoke all on table private.evidence_threshold_configs from public, anon, authenticated;
revoke all on table private.learning_evidence from public, anon, authenticated;
revoke all on table private.activity_decision_log from public, anon, authenticated;
revoke all on function private.derive_session_evidence(uuid) from public, anon, authenticated;
revoke all on function private.refresh_evidence_after_interaction_event()
  from public, anon, authenticated;
revoke all on function public.select_next_activity(uuid, text[]) from public, anon;
grant execute on function public.select_next_activity(uuid, text[]) to authenticated;

comment on table private.learning_evidence is
  'Derived session evidence, kept separate from raw interaction facts and hidden from mobile clients.';
comment on table private.activity_decision_log is
  'Append-only explanations for deterministic activity selection decisions.';
