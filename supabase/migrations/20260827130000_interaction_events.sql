create table private.interaction_events (
  event_id uuid primary key,
  parent_id uuid not null,
  child_id uuid not null,
  session_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  schema_version smallint not null check (schema_version = 1),
  activity_id text not null check (char_length(activity_id) between 1 and 100),
  event_type text not null check (
    event_type in (
      'activity_started',
      'step_presented',
      'choice_selected',
      'hint_requested',
      'activity_completed',
      'activity_abandoned'
    )
  ),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now(),
  foreign key (child_id, parent_id)
    references public.child_profiles (id, parent_id)
    on delete cascade,
  unique (parent_id, child_id, session_id, sequence_number)
);

create index interaction_events_child_occurred_at_idx
on private.interaction_events (child_id, occurred_at);

create function public.sync_interaction_events(events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
  event_value jsonb;
  event_child_id uuid;
  event_session_id uuid;
  event_sequence integer;
  previous_sequence integer;
  batch_child_id uuid;
  batch_session_id uuid;
  inserted_count integer := 0;
  batch_count integer;
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(events) is distinct from 'array' then
    raise exception 'Events must be a JSON array' using errcode = '22023';
  end if;

  batch_count := jsonb_array_length(events);
  if batch_count not between 1 and 100 then
    raise exception 'A sync batch must contain 1-100 events' using errcode = '22023';
  end if;

  for event_value in select value from jsonb_array_elements(events)
  loop
    if jsonb_typeof(event_value) is distinct from 'object'
      or (event_value ->> 'schemaVersion')::integer is distinct from 1
      or jsonb_typeof(event_value -> 'payload') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(event_value -> 'payload')) > 8
      or octet_length((event_value -> 'payload')::text) > 1024
      or exists (
        select 1
        from jsonb_each(event_value -> 'payload') as payload_entry
        where jsonb_typeof(payload_entry.value) in ('array', 'object')
      ) then
      raise exception 'Invalid interaction event payload' using errcode = '22023';
    end if;

    event_child_id := (event_value ->> 'childId')::uuid;
    event_session_id := (event_value ->> 'sessionId')::uuid;
    event_sequence := (event_value ->> 'sequenceNumber')::integer;

    if event_sequence <= 0 then
      raise exception 'Sequence number must be positive' using errcode = '22023';
    end if;

    if batch_child_id is null then
      batch_child_id := event_child_id;
      batch_session_id := event_session_id;
    elsif event_child_id is distinct from batch_child_id
      or event_session_id is distinct from batch_session_id then
      raise exception 'A batch must contain one child and one session' using errcode = '22023';
    end if;

    if previous_sequence is not null and event_sequence <= previous_sequence then
      raise exception 'Events must be ordered by sequence number' using errcode = '22023';
    end if;
    previous_sequence := event_sequence;

    if not exists (
      select 1
      from public.child_profiles as child
      where child.id = event_child_id and child.parent_id = current_parent_id
    ) then
      raise exception 'Child profile not found' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.child_consent_preferences as preference
      where preference.child_id = event_child_id
        and preference.parent_id = current_parent_id
        and preference.consent_type = 'learning_observations'
        and preference.enabled
    ) then
      raise exception 'Learning observation consent is required' using errcode = '42501';
    end if;

    insert into private.interaction_events (
      event_id,
      parent_id,
      child_id,
      session_id,
      sequence_number,
      schema_version,
      activity_id,
      event_type,
      occurred_at,
      payload
    )
    values (
      (event_value ->> 'eventId')::uuid,
      current_parent_id,
      event_child_id,
      event_session_id,
      event_sequence,
      (event_value ->> 'schemaVersion')::smallint,
      event_value ->> 'activityId',
      event_value ->> 'eventType',
      (event_value ->> 'occurredAt')::timestamptz,
      event_value -> 'payload'
    )
    on conflict (event_id) do nothing;

    inserted_count := inserted_count + case when found then 1 else 0 end;
  end loop;

  return jsonb_build_object(
    'acceptedCount', inserted_count,
    'duplicateCount', batch_count - inserted_count
  );
end;
$$;

revoke all on table private.interaction_events from public, anon, authenticated;
revoke all on function public.sync_interaction_events(jsonb) from public, anon;
grant execute on function public.sync_interaction_events(jsonb) to authenticated;

comment on table private.interaction_events is
  'Ordered, minimal child interaction facts. These are not learning evidence, scores, or diagnoses.';
comment on function public.sync_interaction_events(jsonb) is
  'Validates ownership, consent, schema version, ordering, and event-id idempotency for offline batches.';
