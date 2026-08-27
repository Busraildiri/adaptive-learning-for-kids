-- Existing child preferences remain unchanged. Only profiles created after this
-- migration start with all three preferences enabled.
alter table public.child_consent_preferences
alter column enabled set default true;

create or replace function private.initialize_child_consents()
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
    notice_version,
    granted_at
  )
  values
    (
      new.id,
      new.parent_id,
      'personalization',
      true,
      'personalization-v1',
      now()
    ),
    (
      new.id,
      new.parent_id,
      'learning_observations',
      true,
      'learning-observations-v1',
      now()
    ),
    (
      new.id,
      new.parent_id,
      'anonymous_product_improvement',
      true,
      'anonymous-product-improvement-v1',
      now()
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
    (
      new.id,
      new.parent_id,
      'personalization',
      null,
      true,
      'personalization-v1',
      'system_default'
    ),
    (
      new.id,
      new.parent_id,
      'learning_observations',
      null,
      true,
      'learning-observations-v1',
      'system_default'
    ),
    (
      new.id,
      new.parent_id,
      'anonymous_product_improvement',
      null,
      true,
      'anonymous-product-improvement-v1',
      'system_default'
    );

  return new;
end;
$$;

comment on function private.initialize_child_consents() is
  'Creates all three preferences as enabled for new child profiles; existing preferences are not changed.';
comment on table public.child_consent_preferences is
  'Current child-level preferences. Existing pre-R5 profiles stay disabled; newly created child profiles start enabled.';
