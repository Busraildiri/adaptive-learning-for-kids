alter table private.interaction_events
drop constraint if exists interaction_events_event_type_check;

alter table private.interaction_events
add constraint interaction_events_event_type_check check (
  event_type in (
    'activity_started',
    'step_presented',
    'choice_selected',
    'hint_requested',
    'retry_requested',
    'inactivity_help_shown',
    'activity_completed',
    'activity_abandoned'
  )
);

alter table private.parent_session_summary_audit
add column game_status text check (
  game_status in ('consent_required', 'no_activity', 'insufficient_data', 'ready')
),
add column eligible_game_session_count integer not null default 0
  check (eligible_game_session_count >= 0),
add column eligible_game_day_count integer not null default 0
  check (eligible_game_day_count >= 0),
add column game_insight_codes text[] not null default '{}';

create or replace function public.get_parent_session_summary(child_profile_id uuid)
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
  game_session_count integer := 0;
  game_day_count integer := 0;
  completed_game_count integer := 0;
  help_game_count integer := 0;
  retry_game_count integer := 0;
  long_wait_game_count integer := 0;
  abandoned_game_count integer := 0;
  recent_game_sessions jsonb := '[]'::jsonb;
  game_insights jsonb := '[]'::jsonb;
  game_insight_codes text[] := '{}';
  game_status text;
  generated_at timestamptz := now();
  policy_version constant text := 'parent-insight-policy-v2';
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
        and not exists (
          select 1 from private.interaction_events as started
          where started.session_id = event.session_id
            and started.event_type = 'activity_started'
            and started.payload ->> 'activityKind' = 'game'
        )
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

    with game_sessions as (
      select
        started.session_id,
        started.activity_id as game_id,
        min(started.occurred_at) as started_at,
        max(event.occurred_at) as last_event_at,
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
      group by started.session_id, started.activity_id
    ), recent_games as (
      select * from game_sessions
      order by last_event_at desc
      limit 5
    )
    select
      count(*),
      count(distinct started_at::date),
      count(*) filter (where completed),
      count(*) filter (where used_help),
      count(*) filter (where retried),
      count(*) filter (where waited_longer),
      count(*) filter (where abandoned and not completed),
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sessionId', session_id,
            'gameId', game_id,
            'outcome', case when completed then 'completed' else 'left_early' end,
            'occurredAt', last_event_at
          ) order by last_event_at desc
        ) from recent_games
      ), '[]'::jsonb)
    into
      game_session_count,
      game_day_count,
      completed_game_count,
      help_game_count,
      retry_game_count,
      long_wait_game_count,
      abandoned_game_count,
      recent_game_sessions
    from game_sessions;
  end if;

  if not consent_enabled then
    resolved_status := 'consent_required';
    completed_count := 0;
    eligible_count := 0;
    recent_sessions := '[]'::jsonb;
    game_status := 'consent_required';
    game_session_count := 0;
    game_day_count := 0;
    recent_game_sessions := '[]'::jsonb;
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

  if consent_enabled then
    if game_session_count = 0 then
      game_status := 'no_activity';
    elsif game_session_count < 3 or game_day_count < 2 then
      game_status := 'insufficient_data';
    else
      game_status := 'ready';
      if completed_game_count >= 2 then
        game_insights := game_insights || jsonb_build_array(jsonb_build_object(
          'code', 'continued_play',
          'title', 'Oyuna devam etti',
          'text', 'Birden fazla oyun oturumunu tamamladı.',
          'supportingSessionCount', completed_game_count
        ));
        game_insight_codes := array_append(game_insight_codes, 'continued_play');
      end if;
      if help_game_count >= 2 then
        game_insights := game_insights || jsonb_build_array(jsonb_build_object(
          'code', 'support_was_useful',
          'title', 'Destekten yararlandı',
          'text', 'Birden fazla oturumda oyun içi destek gösterildi.',
          'supportingSessionCount', help_game_count
        ));
        game_insight_codes := array_append(game_insight_codes, 'support_was_useful');
      end if;
      if retry_game_count >= 2 then
        game_insights := game_insights || jsonb_build_array(jsonb_build_object(
          'code', 'tried_again',
          'title', 'Yeniden denedi',
          'text', 'Birden fazla oturumda oyunu yeniden denemeyi sürdürdü.',
          'supportingSessionCount', retry_game_count
        ));
        game_insight_codes := array_append(game_insight_codes, 'tried_again');
      end if;
      if long_wait_game_count >= 2 then
        game_insights := game_insights || jsonb_build_array(jsonb_build_object(
          'code', 'took_more_time',
          'title', 'Daha fazla zaman kullandı',
          'text', 'Birden fazla oturumda yönergeden sonra ek süre kullandı.',
          'supportingSessionCount', long_wait_game_count
        ));
        game_insight_codes := array_append(game_insight_codes, 'took_more_time');
      end if;
      if abandoned_game_count >= 2 then
        game_insights := game_insights || jsonb_build_array(jsonb_build_object(
          'code', 'paused_and_left',
          'title', 'Oyuna ara verdi',
          'text', 'Birden fazla oturumda oyunu tamamlamadan kapattı; bu tek başına bir güçlük göstergesi değildir.',
          'supportingSessionCount', abandoned_game_count
        ));
        game_insight_codes := array_append(game_insight_codes, 'paused_and_left');
      end if;
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
    generated_at,
    game_status,
    eligible_game_session_count,
    eligible_game_day_count,
    game_insight_codes
  ) values (
    current_parent_id,
    child_profile_id,
    resolved_status,
    completed_count,
    eligible_count,
    observation_code,
    policy_version,
    generated_at,
    game_status,
    game_session_count,
    game_day_count,
    game_insight_codes
  );

  return jsonb_build_object(
    'schemaVersion', 2,
    'status', resolved_status,
    'childId', child_profile_id,
    'completedSessionCount', completed_count,
    'eligibleSessionCount', eligible_count,
    'recentSessions', recent_sessions,
    'observation', case when observation_code is null then null else jsonb_build_object(
      'code', observation_code,
      'text', observation_text
    ) end,
    'gameStatus', game_status,
    'eligibleGameSessionCount', game_session_count,
    'eligibleGameDayCount', game_day_count,
    'recentGameSessions', recent_game_sessions,
    'gameInsights', game_insights,
    'generatedAt', generated_at,
    'policyVersion', policy_version
  );
end;
$$;

comment on function public.get_parent_session_summary(uuid) is
  'Returns consent-gated story and game summaries. Game cards require three sessions across two days, and each signal requires two sessions.';
