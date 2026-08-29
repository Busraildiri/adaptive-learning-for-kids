create table private.parent_insight_profile_context_audit (
  id bigint generated always as identity primary key,
  parent_id uuid not null,
  child_id uuid not null,
  personalization_context_included boolean not null,
  context_item_count integer not null check (context_item_count >= 0),
  retrieval_policy_version text not null,
  retrieved_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index parent_insight_profile_context_audit_child_idx
on private.parent_insight_profile_context_audit (child_id, retrieved_at desc);

create function public.get_personalized_parent_insight_evidence(child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  profile_record record;
  base_evidence jsonb;
  personalization_consent_enabled boolean := false;
  observation_consent_enabled boolean := false;
  include_profile_context boolean := false;
  age_in_months integer;
  resolved_age_band text;
  context_item_count integer := 0;
  retrieved_at timestamptz := now();
  retrieval_policy_version constant text := 'parent-insight-retrieval-v2';
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select
    child.nickname,
    child.birth_month,
    child.birth_year,
    child.favorite_animals,
    child.favorite_toys,
    child.interests,
    child.updated_at
  into profile_record
  from public.child_profiles as child
  where child.id = child_profile_id
    and child.parent_id = current_parent_id;

  if not found then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;

  select
    coalesce(bool_or(preference.enabled) filter (
      where preference.consent_type = 'personalization'
    ), false),
    coalesce(bool_or(preference.enabled) filter (
      where preference.consent_type = 'learning_observations'
    ), false)
  into personalization_consent_enabled, observation_consent_enabled
  from public.child_consent_preferences as preference
  where preference.child_id = child_profile_id
    and preference.parent_id = current_parent_id;

  include_profile_context :=
    personalization_consent_enabled and observation_consent_enabled;

  age_in_months :=
    extract(year from current_date)::integer * 12
    + extract(month from current_date)::integer
    - profile_record.birth_year * 12
    - profile_record.birth_month;
  resolved_age_band := case
    when age_in_months between 24 and 47 then '2-4'
    when age_in_months between 48 and 83 then '4-7'
    else 'outside_supported_range'
  end;

  if include_profile_context then
    context_item_count :=
      cardinality(profile_record.favorite_animals)
      + cardinality(profile_record.favorite_toys)
      + cardinality(profile_record.interests);
  end if;

  base_evidence := public.get_parent_insight_evidence(child_profile_id);

  insert into private.parent_insight_profile_context_audit (
    parent_id,
    child_id,
    personalization_context_included,
    context_item_count,
    retrieval_policy_version,
    retrieved_at
  ) values (
    current_parent_id,
    child_profile_id,
    include_profile_context,
    context_item_count,
    retrieval_policy_version,
    retrieved_at
  );

  return base_evidence || jsonb_build_object(
    'schemaVersion', 2,
    'retrievedAt', retrieved_at,
    'retrievalPolicyVersion', retrieval_policy_version,
    'profileContext', jsonb_build_object(
      'nickname', profile_record.nickname,
      'ageBand', resolved_age_band,
      'personalizationEnabled', include_profile_context,
      'favoriteAnimals', case
        when include_profile_context then to_jsonb(profile_record.favorite_animals)
        else '[]'::jsonb
      end,
      'favoriteToys', case
        when include_profile_context then to_jsonb(profile_record.favorite_toys)
        else '[]'::jsonb
      end,
      'interests', case
        when include_profile_context then to_jsonb(profile_record.interests)
        else '[]'::jsonb
      end,
      'profileUpdatedAt', profile_record.updated_at
    )
  );
end;
$$;

revoke all on table private.parent_insight_profile_context_audit
from public, anon, authenticated;
revoke all on function public.get_personalized_parent_insight_evidence(uuid)
from public, anon;
grant execute on function public.get_personalized_parent_insight_evidence(uuid)
to authenticated;

comment on table private.parent_insight_profile_context_audit is
  'Audits child-scoped profile context retrieval without storing preference values.';

comment on function public.get_personalized_parent_insight_evidence(uuid) is
  'Retrieves consent-gated session evidence and the selected child profile context. Sibling profiles are never included.';
