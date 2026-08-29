create table private.game_variant_decision_log (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  age_band text not null check (age_band in ('2-4', '4-7')),
  current_difficulty text not null check (
    current_difficulty in ('starter', 'growing', 'advanced')
  ),
  preferred_difficulty text check (
    preferred_difficulty in ('starter', 'growing', 'advanced')
  ),
  reason_code text not null check (
    reason_code in (
      'personalization_disabled',
      'observations_disabled',
      'insufficient_game_sessions',
      'support_across_sessions',
      'independent_completion_across_sessions',
      'general_rotation'
    )
  ),
  explanation text not null,
  personalized boolean not null,
  eligible_session_count integer not null check (eligible_session_count >= 0),
  eligible_day_count integer not null check (eligible_day_count >= 0),
  supporting_session_count integer not null check (supporting_session_count >= 0),
  policy_version text not null,
  decided_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index game_variant_decision_child_idx
on private.game_variant_decision_log (child_id, decided_at desc);

create function public.select_game_variant_preference(
  child_profile_id uuid,
  requested_age_band text,
  current_difficulty text
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
  eligible_session_count integer := 0;
  eligible_day_count integer := 0;
  support_session_count integer := 0;
  independent_completion_count integer := 0;
  preferred_difficulty text := current_difficulty;
  resolved_reason text := 'general_rotation';
  resolved_explanation text := 'Tutarlı bir çoklu oturum sinyali olmadığı için mevcut oyun sırası korunuyor.';
  resolved_personalized boolean := false;
  supporting_count integer := 0;
  policy_version constant text := 'game-personalization-policy-v1';
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_age_band not in ('2-4', '4-7') then
    raise exception 'Unsupported age band' using errcode = '22023';
  end if;
  if current_difficulty not in ('starter', 'growing', 'advanced') then
    raise exception 'Unsupported difficulty' using errcode = '22023';
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

  if personalization_enabled and observations_enabled then
    with game_sessions as (
      select
        started.session_id,
        min(started.occurred_at) as started_at,
        bool_or(event.event_type = 'activity_completed') as completed,
        bool_or(event.event_type in (
          'hint_requested', 'retry_requested', 'inactivity_help_shown'
        )) as used_support
      from private.interaction_events as started
      join private.interaction_events as event
        on event.parent_id = started.parent_id
        and event.child_id = started.child_id
        and event.session_id = started.session_id
      where started.parent_id = current_parent_id
        and started.child_id = child_profile_id
        and started.event_type = 'activity_started'
        and started.payload ->> 'activityKind' = 'game'
        and started.payload ->> 'ageBand' = requested_age_band
      group by started.session_id
    )
    select
      count(*),
      count(distinct started_at::date),
      count(*) filter (where used_support),
      count(*) filter (where completed and not used_support)
    into
      eligible_session_count,
      eligible_day_count,
      support_session_count,
      independent_completion_count
    from game_sessions;
  end if;

  if not personalization_enabled then
    preferred_difficulty := null;
    resolved_reason := 'personalization_disabled';
    resolved_explanation := 'Kişiselleştirme kapalı olduğu için genel oyun sırası kullanılıyor.';
  elsif not observations_enabled then
    preferred_difficulty := null;
    resolved_reason := 'observations_disabled';
    resolved_explanation := 'Öğrenme gözlemleri kapalı olduğu için genel oyun sırası kullanılıyor.';
  elsif eligible_session_count < 3 or eligible_day_count < 2 then
    resolved_reason := 'insufficient_game_sessions';
    resolved_explanation := 'Oyun önerisi için en az üç oturumun iki farklı güne yayılması bekleniyor.';
  elsif support_session_count >= 2 then
    preferred_difficulty := case current_difficulty
      when 'advanced' then 'growing'
      when 'growing' then 'starter'
      else 'starter'
    end;
    resolved_reason := 'support_across_sessions';
    resolved_explanation := 'Birden fazla oturumda destek kullanıldığı için daha sakin bir onaylı varyant öne alındı.';
    resolved_personalized := preferred_difficulty <> current_difficulty;
    supporting_count := support_session_count;
  elsif independent_completion_count >= 3 then
    preferred_difficulty := case current_difficulty
      when 'starter' then 'growing'
      when 'growing' then 'advanced'
      else 'advanced'
    end;
    resolved_reason := 'independent_completion_across_sessions';
    resolved_explanation := 'Birden fazla oturum yardımsız tamamlandığı için bir sonraki onaylı varyant öne alındı.';
    resolved_personalized := preferred_difficulty <> current_difficulty;
    supporting_count := independent_completion_count;
  end if;

  insert into private.game_variant_decision_log (
    parent_id,
    child_id,
    age_band,
    current_difficulty,
    preferred_difficulty,
    reason_code,
    explanation,
    personalized,
    eligible_session_count,
    eligible_day_count,
    supporting_session_count,
    policy_version
  ) values (
    current_parent_id,
    child_profile_id,
    requested_age_band,
    current_difficulty,
    preferred_difficulty,
    resolved_reason,
    resolved_explanation,
    resolved_personalized,
    eligible_session_count,
    eligible_day_count,
    supporting_count,
    policy_version
  );

  return jsonb_build_object(
    'preferredDifficulty', preferred_difficulty,
    'reasonCode', resolved_reason,
    'explanation', resolved_explanation,
    'personalized', resolved_personalized,
    'supportingSessionCount', supporting_count,
    'eligibleSessionCount', eligible_session_count,
    'eligibleDayCount', eligible_day_count,
    'policyVersion', policy_version
  );
end;
$$;

revoke all on table private.game_variant_decision_log from public, anon, authenticated;
revoke all on function public.select_game_variant_preference(uuid, text, text) from public, anon;
grant execute on function public.select_game_variant_preference(uuid, text, text) to authenticated;

comment on table private.game_variant_decision_log is
  'Append-only, consent-gated game variant decisions without scores, traits, diagnoses, or peer comparisons.';
comment on function public.select_game_variant_preference(uuid, text, text) is
  'Suggests one approved difficulty step only after three game sessions across two days; a single error never changes the recommendation.';
