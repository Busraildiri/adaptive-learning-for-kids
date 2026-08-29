-- AI Video panel: prompt-driven interactive story plans with an atomically
-- reserved, never-reused character name. Media topology remains in the
-- existing story_playback_graphs/story_clips tables.

create table private.ai_video_character_names (
  normalized_name text primary key,
  display_name text not null,
  request_id uuid unique,
  reserved_by uuid references auth.users(id),
  reserved_at timestamptz not null default now()
);

create table private.ai_video_story_requests (
  id uuid primary key,
  story_id text not null unique,
  character_name text not null,
  normalized_character_name text not null unique
    references private.ai_video_character_names(normalized_name),
  character_prompt text not null check (char_length(character_prompt) between 20 and 600),
  story_prompt text not null check (char_length(story_prompt) between 20 and 600),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  graph_id uuid references private.story_playback_graphs(id),
  status text not null default 'planned'
    check (status in ('planned', 'jobs_queued', 'rendering', 'ready', 'failed')),
  error text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_video_story_requests_created_idx
  on private.ai_video_story_requests(created_at desc);

revoke all on private.ai_video_character_names from public, anon, authenticated;
revoke all on private.ai_video_story_requests from public, anon, authenticated;

create or replace function private.normalize_ai_character_name(candidate text)
returns text
language sql immutable strict set search_path = ''
as $$
  select regexp_replace(
    lower(translate(trim(candidate), 'ÇĞİIÖŞÜçğııöşü', 'CGIIOSUcgiiiosu')),
    '[^a-z0-9]', '', 'g'
  );
$$;

insert into private.ai_video_character_names(normalized_name, display_name)
select private.normalize_ai_character_name(name), name
from unnest(array[
  'Mino', 'Mırmır', 'Noni', 'Lila', 'Pati', 'Tomo', 'Duru', 'Bobi',
  'Pofi', 'Nino', 'Maya', 'Riko', 'Zuzu', 'Kiki', 'Lina'
]) as seeded(name)
on conflict (normalized_name) do nothing;

create or replace function public.list_ai_video_character_names(target_actor_id uuid)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare result text[];
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  select coalesce(array_agg(display_name order by reserved_at, display_name), array[]::text[])
    into result from private.ai_video_character_names;
  return result;
end;
$$;

create or replace function public.create_ai_video_story_request(
  target_actor_id uuid,
  target_character_prompt text,
  target_story_prompt text,
  target_candidate_names jsonb,
  target_plan_template jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  new_request_id uuid := gen_random_uuid();
  candidate text;
  normalized text;
  selected_name text;
  generated_story_id text;
  final_plan jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  target_character_prompt := trim(target_character_prompt);
  target_story_prompt := trim(target_story_prompt);
  if char_length(target_character_prompt) not between 20 and 600 then
    raise exception 'character_prompt must be 20-600 characters';
  end if;
  if char_length(target_story_prompt) not between 20 and 600 then
    raise exception 'story_prompt must be 20-600 characters';
  end if;
  if jsonb_typeof(target_candidate_names) <> 'array' or jsonb_array_length(target_candidate_names) <> 8 then
    raise exception 'exactly eight candidate names are required';
  end if;
  if jsonb_typeof(target_plan_template) <> 'object' then raise exception 'plan_template must be an object'; end if;
  if position('{{characterName}}' in target_plan_template::text) = 0 then
    raise exception 'plan_template must contain the character-name token';
  end if;

  for candidate in select trim(value) from jsonb_array_elements_text(target_candidate_names)
  loop
    if char_length(candidate) between 2 and 20
       and candidate ~ '^[A-Za-zÇĞİIÖŞÜçğııöşü]+$'
    then
      normalized := private.normalize_ai_character_name(candidate);
      insert into private.ai_video_character_names
        (normalized_name, display_name, request_id, reserved_by)
      values (normalized, candidate, new_request_id, target_actor_id)
      on conflict (normalized_name) do nothing
      returning display_name into selected_name;
      if selected_name is not null then exit; end if;
    end if;
  end loop;

  if selected_name is null then raise exception 'all generated character names are already used'; end if;

  generated_story_id := normalized || '-interactive-' || substring(new_request_id::text from 1 for 8);
  final_plan := replace(target_plan_template::text, '{{characterName}}', selected_name)::jsonb;
  final_plan := jsonb_set(final_plan, '{storyId}', to_jsonb(generated_story_id), true);
  final_plan := jsonb_set(final_plan, '{characterName}', to_jsonb(selected_name), true);
  final_plan := final_plan - 'nameCandidates';

  insert into private.ai_video_story_requests
    (id, story_id, character_name, normalized_character_name, character_prompt,
     story_prompt, plan, created_by)
  values
    (new_request_id, generated_story_id, selected_name, normalized, target_character_prompt,
     target_story_prompt, final_plan, target_actor_id);

  return jsonb_build_object(
    'requestId', new_request_id,
    'storyId', generated_story_id,
    'characterName', selected_name,
    'status', 'planned',
    'plan', final_plan
  );
end;
$$;

create or replace function public.attach_ai_video_story_graph(
  target_actor_id uuid, target_request_id uuid, target_graph_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  if not exists (select 1 from private.story_playback_graphs where id = target_graph_id) then
    raise exception 'playback graph not found';
  end if;
  update private.ai_video_story_requests
    set graph_id = target_graph_id, status = 'jobs_queued', error = null, updated_at = now()
  where id = target_request_id and created_by = target_actor_id;
  if not found then raise exception 'AI video story request not found'; end if;
end;
$$;

create or replace function public.update_ai_video_story_request_status(
  target_actor_id uuid, target_request_id uuid, new_status text, new_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  if new_status not in ('planned', 'jobs_queued', 'rendering', 'ready', 'failed') then
    raise exception 'invalid AI video story status';
  end if;
  update private.ai_video_story_requests
    set status = new_status, error = new_error, updated_at = now()
  where id = target_request_id and created_by = target_actor_id;
  if not found then raise exception 'AI video story request not found'; end if;
end;
$$;

create or replace function public.get_ai_video_story_request(target_actor_id uuid, target_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare request_row private.ai_video_story_requests%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  select * into request_row from private.ai_video_story_requests
    where id = target_request_id and created_by = target_actor_id;
  if not found then raise exception 'AI video story request not found'; end if;
  return jsonb_build_object(
    'requestId', request_row.id,
    'storyId', request_row.story_id,
    'characterName', request_row.character_name,
    'status', request_row.status,
    'error', request_row.error,
    'graphId', request_row.graph_id,
    'plan', request_row.plan,
    'createdAt', request_row.created_at,
    'updatedAt', request_row.updated_at
  );
end;
$$;

revoke all on function public.list_ai_video_character_names(uuid) from public, anon, authenticated;
revoke all on function public.create_ai_video_story_request(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.attach_ai_video_story_graph(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.update_ai_video_story_request_status(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_ai_video_story_request(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.list_ai_video_character_names(uuid) to service_role;
grant execute on function public.create_ai_video_story_request(uuid, text, text, jsonb, jsonb)
  to service_role;
grant execute on function public.attach_ai_video_story_graph(uuid, uuid, uuid) to service_role;
grant execute on function public.update_ai_video_story_request_status(uuid, uuid, text, text)
  to service_role;
grant execute on function public.get_ai_video_story_request(uuid, uuid) to service_role;

comment on table private.ai_video_character_names is
  'Permanent normalized-name registry. A character name is never reused, including Turkish spelling variants.';
comment on table private.ai_video_story_requests is
  'Prompt-driven interactive story plan and its playback-graph/render lifecycle.';
