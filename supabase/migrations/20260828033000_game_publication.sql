create table private.game_drafts (
  game_id text primary key,
  game_version integer not null check (game_version > 0),
  age_band text not null check (age_band in ('2-4', '4-7')),
  game jsonb not null,
  saved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_draft_identity_matches check (
    game->>'id' = game_id
    and (game->>'version')::integer = game_version
    and game->>'ageBand' = age_band
    and game->>'status' = 'draft'
    and game->>'schemaVersion' = 'game-v1'
    and game->>'mechanic' = 'tap_or_wait'
  )
);

create table public.published_game_versions (
  game_id text not null,
  game_version integer not null check (game_version > 0),
  age_band text not null check (age_band in ('2-4', '4-7')),
  game jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key (game_id, game_version),
  constraint published_game_identity_matches check (
    game->>'id' = game_id
    and (game->>'version')::integer = game_version
    and game->>'ageBand' = age_band
    and game->>'status' = 'published'
    and game->>'schemaVersion' = 'game-v1'
    and game->>'mechanic' = 'tap_or_wait'
  )
);

create index published_game_versions_age_idx
on public.published_game_versions (age_band, published_at desc);

alter table public.published_game_versions enable row level security;
revoke all on private.game_drafts from public, anon, authenticated;
revoke all on public.published_game_versions from anon, authenticated;
grant select on public.published_game_versions to authenticated;

create policy "Signed-in families can read published games"
on public.published_game_versions for select to authenticated using (true);

create or replace function public.save_game_draft(candidate_game jsonb, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  candidate_id text;
  candidate_age_band text;
  next_version integer;
  normalized_game jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;
  if jsonb_typeof(candidate_game) <> 'object' then raise exception 'game must be an object'; end if;

  candidate_id := nullif(trim(candidate_game->>'id'), '');
  candidate_age_band := candidate_game->>'ageBand';
  if candidate_id is null then raise exception 'game id required'; end if;
  if candidate_age_band not in ('2-4', '4-7') then raise exception 'invalid age band'; end if;
  if candidate_game->>'schemaVersion' <> 'game-v1' then raise exception 'invalid game schema'; end if;
  if candidate_game->>'mechanic' <> 'tap_or_wait' then raise exception 'unsupported game mechanic'; end if;

  select coalesce(max(game_version), 0) + 1 into next_version
  from public.published_game_versions where game_id = candidate_id;
  normalized_game := jsonb_set(
    jsonb_set(candidate_game, '{status}', '"draft"'::jsonb, true),
    '{version}', to_jsonb(next_version), true
  );

  insert into private.game_drafts
    (game_id, game_version, age_band, game, saved_by)
  values
    (candidate_id, next_version, candidate_age_band, normalized_game, actor_id)
  on conflict (game_id) do update set
    game_version = excluded.game_version,
    age_band = excluded.age_band,
    game = excluded.game,
    saved_by = excluded.saved_by,
    updated_at = now();

  return normalized_game;
end;
$$;

create or replace function public.publish_game_draft(target_game_id text, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  draft private.game_drafts%rowtype;
  published_game jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;
  select * into draft from private.game_drafts where game_id = target_game_id for update;
  if not found then raise exception 'game draft not found'; end if;

  published_game := jsonb_set(draft.game, '{status}', '"published"'::jsonb, true);
  insert into public.published_game_versions
    (game_id, game_version, age_band, game, published_by)
  values
    (draft.game_id, draft.game_version, draft.age_band, published_game, actor_id);
  delete from private.game_drafts where game_id = draft.game_id;
  return published_game;
end;
$$;

revoke all on function public.save_game_draft(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.publish_game_draft(text, uuid) from public, anon, authenticated;
grant execute on function public.save_game_draft(jsonb, uuid) to service_role;
grant execute on function public.publish_game_draft(text, uuid) to service_role;

comment on table public.published_game_versions is
  'Immutable, age-filterable game versions available to signed-in family clients.';
