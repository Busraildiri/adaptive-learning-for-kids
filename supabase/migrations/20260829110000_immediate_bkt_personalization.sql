create or replace function public.select_bkt_routine_variant(
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
  mastery_probability double precision := 0.25;
  posterior_probability double precision := 0;
  evidence_probability double precision := 0;
  observation_count integer := 0;
  correct_observation_count integer := 0;
  incorrect_observation_count integer := 0;
  eligible_session_count integer := 0;
  eligible_day_count integer := 0;
  target_difficulty text := 'starter';
  preferred_difficulty text := current_difficulty;
  resolved_reason text := 'general_rotation';
  resolved_explanation text := 'Mevcut onaylı rutin düzeyi korunuyor.';
  resolved_personalized boolean := false;
  supporting_count integer := 0;
  observation_record record;
  policy_version constant text := 'game-personalization-policy-v2';
  learning_rate constant double precision := 0.15;
  guess_rate constant double precision := 0.20;
  slip_rate constant double precision := 0.10;
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
    with opportunities as (
      select event.session_id, event.occurred_at
      from private.interaction_events as event
      where event.parent_id = current_parent_id
        and event.child_id = child_profile_id
        and event.event_type = 'choice_selected'
        and event.payload ? 'bktCorrect'
        and jsonb_typeof(event.payload -> 'bktCorrect') = 'boolean'
        and exists (
          select 1
          from private.interaction_events as started
          where started.parent_id = event.parent_id
            and started.child_id = event.child_id
            and started.session_id = event.session_id
            and started.event_type = 'activity_started'
            and started.payload ->> 'activityKind' = 'game'
            and started.payload ->> 'mechanic' = 'sequence_and_place'
            and started.payload ->> 'ageBand' = requested_age_band
        )
    )
    select count(distinct session_id), count(distinct occurred_at::date)
    into eligible_session_count, eligible_day_count
    from opportunities;

    for observation_record in
      select (event.payload ->> 'bktCorrect')::boolean as correct
      from private.interaction_events as event
      where event.parent_id = current_parent_id
        and event.child_id = child_profile_id
        and event.event_type = 'choice_selected'
        and event.payload ? 'bktCorrect'
        and jsonb_typeof(event.payload -> 'bktCorrect') = 'boolean'
        and exists (
          select 1
          from private.interaction_events as started
          where started.parent_id = event.parent_id
            and started.child_id = event.child_id
            and started.session_id = event.session_id
            and started.event_type = 'activity_started'
            and started.payload ->> 'activityKind' = 'game'
            and started.payload ->> 'mechanic' = 'sequence_and_place'
            and started.payload ->> 'ageBand' = requested_age_band
        )
      order by event.occurred_at, event.sequence_number
    loop
      observation_count := observation_count + 1;
      if observation_record.correct then
        correct_observation_count := correct_observation_count + 1;
        evidence_probability :=
          mastery_probability * (1 - slip_rate)
          + (1 - mastery_probability) * guess_rate;
        posterior_probability :=
          mastery_probability * (1 - slip_rate) / evidence_probability;
      else
        incorrect_observation_count := incorrect_observation_count + 1;
        evidence_probability :=
          mastery_probability * slip_rate
          + (1 - mastery_probability) * (1 - guess_rate);
        posterior_probability :=
          mastery_probability * slip_rate / evidence_probability;
      end if;
      mastery_probability :=
        posterior_probability + (1 - posterior_probability) * learning_rate;
    end loop;
  end if;

  if not personalization_enabled then
    preferred_difficulty := null;
    resolved_reason := 'personalization_disabled';
    resolved_explanation := 'Kişiselleştirme kapalı olduğu için genel oyun sırası kullanılıyor.';
  elsif not observations_enabled then
    preferred_difficulty := null;
    resolved_reason := 'observations_disabled';
    resolved_explanation := 'Öğrenme gözlemleri kapalı olduğu için genel oyun sırası kullanılıyor.';
  elsif observation_count < 4 then
    resolved_reason := 'insufficient_game_sessions';
    resolved_explanation := 'Rutin düzeyi için en az dört tur denemesi bekleniyor.';
  else
    if observation_count >= 8 and mastery_probability >= 0.80 then
      target_difficulty := 'advanced';
    elsif mastery_probability >= 0.55 then
      target_difficulty := 'growing';
    else
      target_difficulty := 'starter';
    end if;

    preferred_difficulty := case
      when current_difficulty = 'starter' and target_difficulty in ('growing', 'advanced')
        then 'growing'
      when current_difficulty = 'advanced' and target_difficulty in ('starter', 'growing')
        then 'growing'
      else target_difficulty
    end;
    resolved_personalized := preferred_difficulty <> current_difficulty;

    if resolved_personalized and (
      (current_difficulty = 'advanced' and preferred_difficulty in ('starter', 'growing'))
      or (current_difficulty = 'growing' and preferred_difficulty = 'starter')
    ) then
      resolved_reason := 'support_across_sessions';
      resolved_explanation :=
        'Rutin denemelerinde destek gerektiği için daha sakin bir onaylı düzey öne alındı.';
      supporting_count := incorrect_observation_count;
    elsif resolved_personalized then
      resolved_reason := 'independent_completion_across_sessions';
      resolved_explanation :=
        'Rutin denemeleri bağımsız tamamlandığı için sonraki onaylı düzey öne alındı.';
      supporting_count := correct_observation_count;
    else
      resolved_reason := 'general_rotation';
      resolved_explanation := 'Rutin denemelerine göre mevcut onaylı düzey korunuyor.';
      supporting_count := observation_count;
    end if;
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

comment on function public.select_bkt_routine_variant(uuid, text, text) is
  'Applies the approved routine BKT model as soon as the per-round evidence threshold is met; changes at most one approved level.';
