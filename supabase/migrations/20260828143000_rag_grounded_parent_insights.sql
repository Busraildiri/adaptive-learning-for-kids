create table private.parent_insight_retrieval_audit (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  consent_enabled boolean not null,
  story_evidence_count integer not null check (story_evidence_count >= 0),
  game_evidence_count integer not null check (game_evidence_count >= 0),
  retrieval_policy_version text not null,
  retrieved_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index parent_insight_retrieval_audit_child_idx
on private.parent_insight_retrieval_audit (child_id, retrieved_at desc);

create function public.get_parent_insight_evidence(child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  consent_enabled boolean := false;
  story_evidence jsonb := '[]'::jsonb;
  game_evidence jsonb := '[]'::jsonb;
  story_evidence_count integer := 0;
  game_evidence_count integer := 0;
  retrieved_at timestamptz := now();
  retrieval_policy_version constant text := 'parent-insight-retrieval-v1';
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.child_profiles
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
    with eligible_story_evidence as (
      select
        evidence.session_id,
        evidence.activity_id,
        coalesce(
          max(event.occurred_at) filter (where event.event_type = 'activity_completed'),
          evidence.derived_at
        ) as completed_at,
        evidence.classification
      from private.learning_evidence as evidence
      left join private.interaction_events as event
        on event.session_id = evidence.session_id
        and event.parent_id = evidence.parent_id
        and event.child_id = evidence.child_id
      where evidence.child_id = child_profile_id
        and evidence.parent_id = current_parent_id
        and evidence.classification in ('valid_evidence', 'limited_evidence')
        and not exists (
          select 1
          from private.interaction_events as started
          where started.session_id = evidence.session_id
            and started.parent_id = evidence.parent_id
            and started.child_id = evidence.child_id
            and started.event_type = 'activity_started'
            and started.payload ->> 'activityKind' = 'game'
        )
      group by
        evidence.session_id,
        evidence.activity_id,
        evidence.derived_at,
        evidence.classification
      order by completed_at desc
      limit 50
    )
    select
      count(*),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sessionId', session_id,
            'activityId', activity_id,
            'completedAt', completed_at,
            'classification', classification
          ) order by completed_at desc
        ),
        '[]'::jsonb
      )
    into story_evidence_count, story_evidence
    from eligible_story_evidence;

    with game_sessions as (
      select
        started.session_id,
        min(started.activity_id) as game_id,
        max(event.occurred_at) as occurred_at,
        bool_or(event.event_type = 'activity_completed') as completed,
        bool_or(event.event_type = 'activity_abandoned') as abandoned,
        bool_or(event.event_type = 'hint_requested') as used_help,
        bool_or(event.event_type = 'retry_requested') as retried,
        bool_or(event.event_type = 'inactivity_help_shown') as waited_longer
      from private.interaction_events as started
      join private.interaction_events as event
        on event.session_id = started.session_id
        and event.parent_id = started.parent_id
        and event.child_id = started.child_id
      where started.child_id = child_profile_id
        and started.parent_id = current_parent_id
        and started.event_type = 'activity_started'
        and started.payload ->> 'activityKind' = 'game'
      group by started.session_id
    ), eligible_game_evidence as (
      select *
      from game_sessions
      where completed or abandoned or used_help or retried or waited_longer
      order by occurred_at desc
      limit 50
    )
    select
      count(*),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sessionId', session_id,
            'gameId', game_id,
            'outcome', case
              when completed then 'completed'
              when abandoned then 'left_early'
              else 'in_progress'
            end,
            'occurredAt', occurred_at,
            'signals', to_jsonb(array_remove(array[
              case when completed then 'completed' end,
              case when used_help then 'help_shown' end,
              case when retried then 'retried' end,
              case when waited_longer then 'waited_longer' end,
              case when abandoned and not completed then 'left_early' end
            ]::text[], null))
          ) order by occurred_at desc
        ),
        '[]'::jsonb
      )
    into game_evidence_count, game_evidence
    from eligible_game_evidence;
  end if;

  insert into private.parent_insight_retrieval_audit (
    parent_id,
    child_id,
    consent_enabled,
    story_evidence_count,
    game_evidence_count,
    retrieval_policy_version,
    retrieved_at
  ) values (
    current_parent_id,
    child_profile_id,
    consent_enabled,
    story_evidence_count,
    game_evidence_count,
    retrieval_policy_version,
    retrieved_at
  );

  return jsonb_build_object(
    'schemaVersion', 1,
    'childId', child_profile_id,
    'consentEnabled', consent_enabled,
    'source', 'consented_session_event_projection',
    'storyEvidence', story_evidence,
    'gameEvidence', game_evidence,
    'retrievedAt', retrieved_at,
    'retrievalPolicyVersion', retrieval_policy_version
  );
end;
$$;

revoke all on table private.parent_insight_retrieval_audit from public, anon, authenticated;
revoke all on function public.get_parent_insight_evidence(uuid) from public, anon;
grant execute on function public.get_parent_insight_evidence(uuid) to authenticated;

comment on table private.parent_insight_retrieval_audit is
  'Records consent-gated evidence retrievals without storing generated parent-facing claims.';

comment on function public.get_parent_insight_evidence(uuid) is
  'Retrieves a minimal, consent-gated projection of eligible story and game session evidence. Raw choices and free-form payloads are excluded.';
