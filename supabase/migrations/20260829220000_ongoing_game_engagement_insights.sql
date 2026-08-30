create or replace function public.get_parent_insight_evidence(child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  evidence_bundle jsonb;
  enriched_game_evidence jsonb := '[]'::jsonb;
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  evidence_bundle := public.get_parent_insight_evidence_base(child_profile_id);

  select coalesce(jsonb_agg(
    game_item || jsonb_build_object(
      'adaptiveLevel', session_facts.adaptive_level,
      'difficulty', session_facts.difficulty,
      'signals',
      (
        select coalesce(jsonb_agg(signal order by signal), '[]'::jsonb)
        from (
          select distinct jsonb_array_elements_text(game_item -> 'signals') as signal
          union
          select 'progressed'
          where game_item ->> 'outcome' <> 'completed'
            and session_facts.correct_choice_count > 0
          union
          select 'replayed'
          where session_facts.game_session_count >= 2
          union
          select 'completed_without_replay'
          where game_item ->> 'outcome' = 'completed'
            and session_facts.game_session_count = 1
          union
          select 'left_at_higher_difficulty'
          where game_item ->> 'outcome' <> 'completed'
            and session_facts.difficulty in ('growing', 'advanced')
        ) as collected_signals
      )
    )
  ), '[]'::jsonb)
  into enriched_game_evidence
  from jsonb_array_elements(evidence_bundle -> 'gameEvidence') as items(game_item)
  cross join lateral (
    select
      max(
        case
          when event.payload ->> 'adaptiveLevel' ~ '^[0-9]+$'
            then (event.payload ->> 'adaptiveLevel')::integer
          else null
        end
      ) as adaptive_level,
      max(event.payload ->> 'difficulty') filter (
        where event.payload ->> 'difficulty' in ('starter', 'growing', 'advanced')
      ) as difficulty,
      count(*) filter (
        where event.event_type = 'choice_selected'
          and event.payload ->> 'bktCorrect' = 'true'
      ) as correct_choice_count,
      (
        select count(distinct started.session_id)
        from private.interaction_events as started
        where started.parent_id = current_parent_id
          and started.child_id = child_profile_id
          and started.event_type = 'activity_started'
          and started.payload ->> 'activityKind' = 'game'
          and started.activity_id = game_item ->> 'gameId'
      ) as game_session_count
    from private.interaction_events as event
    where event.parent_id = current_parent_id
      and event.child_id = child_profile_id
      and event.session_id = (game_item ->> 'sessionId')::uuid
  ) as session_facts;

  return jsonb_set(evidence_bundle, '{gameEvidence}', enriched_game_evidence, true);
end;
$$;

revoke all on function public.get_parent_insight_evidence(uuid) from public, anon;
grant execute on function public.get_parent_insight_evidence(uuid) to authenticated;

comment on function public.get_parent_insight_evidence(uuid) is
  'Returns consented game evidence with progress, replay, completion-return, adaptive level, and difficulty dropout signals.';
