create table public.child_momo_customizations (
  child_id uuid primary key references public.child_profiles (id) on delete cascade,
  selected_part_id text not null
    check (selected_part_id in ('star-antenna', 'spring-antenna')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger child_momo_customizations_set_updated_at
before update on public.child_momo_customizations
for each row execute function private.set_updated_at();

alter table public.child_momo_customizations enable row level security;
revoke all on table public.child_momo_customizations from anon, authenticated;
grant select, insert, update on table public.child_momo_customizations to authenticated;

create policy "Parents can read their child's Momo customization"
on public.child_momo_customizations
for select
to authenticated
using (
  exists (
    select 1
    from public.child_profiles as child
    where child.id = child_momo_customizations.child_id
      and child.parent_id = (select auth.uid())
  )
);

create policy "Parents can create their child's Momo customization"
on public.child_momo_customizations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.child_profiles as child
    where child.id = child_momo_customizations.child_id
      and child.parent_id = (select auth.uid())
  )
);

create policy "Parents can update their child's Momo customization"
on public.child_momo_customizations
for update
to authenticated
using (
  exists (
    select 1
    from public.child_profiles as child
    where child.id = child_momo_customizations.child_id
      and child.parent_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.child_profiles as child
    where child.id = child_momo_customizations.child_id
      and child.parent_id = (select auth.uid())
  )
);

alter table private.game_drafts
drop constraint game_draft_identity_matches;

alter table private.game_drafts
add constraint game_draft_identity_matches check (
  game->>'id' = game_id
  and (game->>'version')::integer = game_version
  and game->>'ageBand' = age_band
  and game->>'status' = 'draft'
  and game->>'schemaVersion' = 'game-v1'
  and game->>'mechanic' in (
    'tap_or_wait',
    'classify_and_sort',
    'sequence_and_place',
    'emotion_clues',
    'fish_patterns',
    'balloon_counting',
    'mini_challenge',
    'momo_workshop'
  )
);

alter table public.published_game_versions
drop constraint published_game_identity_matches;

alter table public.published_game_versions
add constraint published_game_identity_matches check (
  game->>'id' = game_id
  and (game->>'version')::integer = game_version
  and game->>'ageBand' = age_band
  and game->>'status' = 'published'
  and game->>'schemaVersion' = 'game-v1'
  and game->>'mechanic' in (
    'tap_or_wait',
    'classify_and_sort',
    'sequence_and_place',
    'emotion_clues',
    'fish_patterns',
    'balloon_counting',
    'mini_challenge',
    'momo_workshop'
  )
);

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
  if candidate_game->>'mechanic' not in (
    'tap_or_wait',
    'classify_and_sort',
    'sequence_and_place',
    'emotion_clues',
    'fish_patterns',
    'balloon_counting',
    'mini_challenge',
    'momo_workshop'
  ) then
    raise exception 'unsupported game mechanic';
  end if;

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

comment on table public.child_momo_customizations is
  'Stores only the single currently selected Momo part for a child profile.';
