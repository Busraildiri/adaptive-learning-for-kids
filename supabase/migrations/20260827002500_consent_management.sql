create table public.child_consent_preferences (
  child_id uuid not null,
  parent_id uuid not null,
  consent_type text not null check (
    consent_type in ('personalization', 'learning_observations', 'anonymous_product_improvement')
  ),
  enabled boolean not null default false,
  notice_version text not null check (
    (consent_type = 'personalization' and notice_version = 'personalization-v1')
    or (consent_type = 'learning_observations' and notice_version = 'learning-observations-v1')
    or (
      consent_type = 'anonymous_product_improvement'
      and notice_version = 'anonymous-product-improvement-v1'
    )
  ),
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (child_id, consent_type),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade,
  check (not enabled or (granted_at is not null and withdrawn_at is null))
);

create index child_consent_preferences_parent_id_idx
on public.child_consent_preferences (parent_id);

create table private.child_consent_audit_log (
  id bigint generated always as identity primary key,
  child_id uuid not null,
  parent_id uuid not null,
  consent_type text not null,
  previous_enabled boolean,
  enabled boolean not null,
  notice_version text not null,
  change_source text not null check (change_source in ('system_default', 'parent_action')),
  occurred_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade
);

create index child_consent_audit_log_child_id_idx
on private.child_consent_audit_log (child_id, occurred_at);

create function private.initialize_child_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.child_consent_preferences (
    child_id,
    parent_id,
    consent_type,
    enabled,
    notice_version
  )
  values
    (new.id, new.parent_id, 'personalization', false, 'personalization-v1'),
    (new.id, new.parent_id, 'learning_observations', false, 'learning-observations-v1'),
    (
      new.id,
      new.parent_id,
      'anonymous_product_improvement',
      false,
      'anonymous-product-improvement-v1'
    );

  insert into private.child_consent_audit_log (
    child_id,
    parent_id,
    consent_type,
    previous_enabled,
    enabled,
    notice_version,
    change_source
  )
  values
    (new.id, new.parent_id, 'personalization', null, false, 'personalization-v1', 'system_default'),
    (
      new.id,
      new.parent_id,
      'learning_observations',
      null,
      false,
      'learning-observations-v1',
      'system_default'
    ),
    (
      new.id,
      new.parent_id,
      'anonymous_product_improvement',
      null,
      false,
      'anonymous-product-improvement-v1',
      'system_default'
    );

  return new;
end;
$$;

create trigger child_profiles_initialize_consents
after insert on public.child_profiles
for each row execute function private.initialize_child_consents();

with inserted_preferences as (
  insert into public.child_consent_preferences (
    child_id,
    parent_id,
    consent_type,
    enabled,
    notice_version
  )
  select
    child.id,
    child.parent_id,
    consent.consent_type,
    false,
    consent.notice_version
  from public.child_profiles as child
  cross join (
    values
      ('personalization', 'personalization-v1'),
      ('learning_observations', 'learning-observations-v1'),
      ('anonymous_product_improvement', 'anonymous-product-improvement-v1')
  ) as consent (consent_type, notice_version)
  on conflict (child_id, consent_type) do nothing
  returning child_id, parent_id, consent_type, enabled, notice_version
)
insert into private.child_consent_audit_log (
  child_id,
  parent_id,
  consent_type,
  previous_enabled,
  enabled,
  notice_version,
  change_source
)
select
  child_id,
  parent_id,
  consent_type,
  null,
  enabled,
  notice_version,
  'system_default'
from inserted_preferences;

-- Optional profile details collected before explicit consent existed are not grandfathered in.
update public.child_profiles
set
  favorite_animals = '{}',
  favorite_toys = '{}',
  interests = '{}'
where cardinality(favorite_animals) > 0
  or cardinality(favorite_toys) > 0
  or cardinality(interests) > 0;

create function private.enforce_child_personalization_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    cardinality(new.favorite_animals) > 0
    or cardinality(new.favorite_toys) > 0
    or cardinality(new.interests) > 0
  ) and not exists (
    select 1
    from public.child_consent_preferences as preference
    where preference.child_id = new.id
      and preference.parent_id = new.parent_id
      and preference.consent_type = 'personalization'
      and preference.enabled
  ) then
    raise exception 'Personalization consent is required for optional profile data'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger child_profiles_require_personalization_consent_on_insert
before insert on public.child_profiles
for each row execute function private.enforce_child_personalization_consent();

create trigger child_profiles_require_personalization_consent_on_update
before update of favorite_animals, favorite_toys, interests on public.child_profiles
for each row execute function private.enforce_child_personalization_consent();

create trigger child_consent_preferences_set_updated_at
before update on public.child_consent_preferences
for each row execute function private.set_updated_at();

create function private.expected_consent_notice_version(consent_kind text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case consent_kind
    when 'personalization' then 'personalization-v1'
    when 'learning_observations' then 'learning-observations-v1'
    when 'anonymous_product_improvement' then 'anonymous-product-improvement-v1'
  end;
$$;

create function private.apply_child_consent(
  current_parent_id uuid,
  child_profile_id uuid,
  consent_kind text,
  is_enabled boolean,
  consent_notice_version text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  expected_version text := private.expected_consent_notice_version(consent_kind);
  previous_enabled boolean;
  previous_version text;
begin
  if expected_version is null then
    raise exception 'Unsupported consent type' using errcode = '22023';
  end if;

  if consent_notice_version is distinct from expected_version then
    raise exception 'Unsupported consent notice version' using errcode = '22023';
  end if;

  if is_enabled is null then
    raise exception 'Consent state is required' using errcode = '22004';
  end if;

  if not exists (
    select 1
    from public.child_profiles
    where id = child_profile_id and parent_id = current_parent_id
  ) then
    raise exception 'Child profile not found' using errcode = '42501';
  end if;

  select preference.enabled, preference.notice_version
  into previous_enabled, previous_version
  from public.child_consent_preferences as preference
  where preference.child_id = child_profile_id
    and preference.parent_id = current_parent_id
    and preference.consent_type = consent_kind
  for update;

  if not found then
    raise exception 'Consent preference not initialized' using errcode = '55000';
  end if;

  if previous_enabled is not distinct from is_enabled
    and previous_version is not distinct from consent_notice_version then
    return;
  end if;

  update public.child_consent_preferences
  set
    enabled = is_enabled,
    notice_version = consent_notice_version,
    granted_at = case when is_enabled then now() else granted_at end,
    withdrawn_at = case when is_enabled then null else now() end
  where child_id = child_profile_id
    and parent_id = current_parent_id
    and consent_type = consent_kind;

  insert into private.child_consent_audit_log (
    child_id,
    parent_id,
    consent_type,
    previous_enabled,
    enabled,
    notice_version,
    change_source
  )
  values (
    child_profile_id,
    current_parent_id,
    consent_kind,
    previous_enabled,
    is_enabled,
    consent_notice_version,
    'parent_action'
  );
end;
$$;

create function public.set_child_consent(
  child_profile_id uuid,
  consent_kind text,
  is_enabled boolean,
  consent_notice_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if consent_kind = 'personalization' then
    raise exception 'Use set_child_personalization for personalization consent'
      using errcode = '22023';
  end if;

  perform private.apply_child_consent(
    current_parent_id,
    child_profile_id,
    consent_kind,
    is_enabled,
    consent_notice_version
  );
end;
$$;

create function public.set_child_personalization(
  child_profile_id uuid,
  is_enabled boolean,
  consent_notice_version text,
  favorite_animals text[] default '{}',
  favorite_toys text[] default '{}',
  interests text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  normalized_animals text[] := coalesce(favorite_animals, '{}');
  normalized_toys text[] := coalesce(favorite_toys, '{}');
  normalized_interests text[] := coalesce(interests, '{}');
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if cardinality(normalized_animals) > 10
    or cardinality(normalized_toys) > 10
    or cardinality(normalized_interests) > 10
    or char_length(array_to_string(normalized_animals, ',')) > 500
    or char_length(array_to_string(normalized_toys, ',')) > 500
    or char_length(array_to_string(normalized_interests, ',')) > 500 then
    raise exception 'Personalization lists exceed their limits' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(normalized_animals || normalized_toys || normalized_interests) as item
    where char_length(btrim(item)) not between 1 and 100
  ) then
    raise exception 'Personalization items must contain 1-100 characters' using errcode = '22023';
  end if;

  perform private.apply_child_consent(
    current_parent_id,
    child_profile_id,
    'personalization',
    is_enabled,
    consent_notice_version
  );

  update public.child_profiles
  set
    favorite_animals = case when is_enabled then normalized_animals else '{}' end,
    favorite_toys = case when is_enabled then normalized_toys else '{}' end,
    interests = case when is_enabled then normalized_interests else '{}' end
  where id = child_profile_id and parent_id = current_parent_id;
end;
$$;

alter table public.child_consent_preferences enable row level security;

revoke all on table public.child_consent_preferences from anon, authenticated;
revoke all on table private.child_consent_audit_log from public, anon, authenticated;
revoke all on function private.initialize_child_consents() from public, anon, authenticated;
revoke all on function private.enforce_child_personalization_consent()
  from public, anon, authenticated;
revoke all on function private.expected_consent_notice_version(text) from public, anon, authenticated;
revoke all on function private.apply_child_consent(uuid, uuid, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.set_child_consent(uuid, text, boolean, text) from public, anon;
revoke all on function public.set_child_personalization(uuid, boolean, text, text[], text[], text[])
  from public, anon;

grant select on table public.child_consent_preferences to authenticated;
grant execute on function public.set_child_consent(uuid, text, boolean, text) to authenticated;
grant execute on function public.set_child_personalization(uuid, boolean, text, text[], text[], text[])
  to authenticated;

create policy "Parents can read their own child consent preferences"
on public.child_consent_preferences
for select
to authenticated
using ((select auth.uid()) = parent_id);

comment on table public.child_consent_preferences is
  'Current child-level consent choices. Every child starts with all optional permissions disabled.';
comment on table private.child_consent_audit_log is
  'Append-only consent history. Not exposed through the mobile Data API.';
comment on function public.set_child_consent(uuid, text, boolean, text) is
  'Changes non-personalization consent after ownership and notice-version checks.';
comment on function public.set_child_personalization(uuid, boolean, text, text[], text[], text[]) is
  'Atomically changes personalization consent and stores or clears optional preference data.';
