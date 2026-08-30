alter function public.get_parent_insight_evidence(uuid)
rename to get_parent_insight_evidence_base;

create function public.get_parent_insight_evidence(child_profile_id uuid)
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
      'signals',
      (
        select coalesce(jsonb_agg(signal order by signal), '[]'::jsonb)
        from (
          select distinct jsonb_array_elements_text(game_item -> 'signals') as signal
          union
          select 'progressed'
          where game_item ->> 'outcome' <> 'completed'
            and exists (
            select 1
            from private.interaction_events as progress_event
            where progress_event.parent_id = current_parent_id
              and progress_event.child_id = child_profile_id
              and progress_event.session_id = (game_item ->> 'sessionId')::uuid
              and progress_event.event_type = 'choice_selected'
              and progress_event.payload ->> 'bktCorrect' = 'true'
          )
          union
          select 'replayed'
          where (
            select count(distinct started.session_id)
            from private.interaction_events as started
            where started.parent_id = current_parent_id
              and started.child_id = child_profile_id
              and started.event_type = 'activity_started'
              and started.payload ->> 'activityKind' = 'game'
              and started.activity_id = game_item ->> 'gameId'
          ) >= 2
        ) as collected_signals
      )
    )
  ), '[]'::jsonb)
  into enriched_game_evidence
  from jsonb_array_elements(evidence_bundle -> 'gameEvidence') as items(game_item);

  return jsonb_set(evidence_bundle, '{gameEvidence}', enriched_game_evidence, true);
end;
$$;

revoke all on function public.get_parent_insight_evidence_base(uuid) from public, anon, authenticated;
revoke all on function public.get_parent_insight_evidence(uuid) from public, anon;
grant execute on function public.get_parent_insight_evidence(uuid) to authenticated;

comment on function public.get_parent_insight_evidence(uuid) is
  'Returns consented story and game evidence enriched with partial progress and replay signals.';
