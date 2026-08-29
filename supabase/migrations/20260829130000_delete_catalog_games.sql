create table public.game_catalog_tombstones (
  game_id text primary key,
  deleted_from_status text not null check (deleted_from_status in ('published', 'archived')),
  deleted_by uuid not null references auth.users(id),
  deleted_at timestamptz not null default now()
);

alter table public.game_catalog_tombstones enable row level security;
revoke all on public.game_catalog_tombstones from public, anon, authenticated;
grant select (game_id) on public.game_catalog_tombstones to authenticated;

create policy "Signed-in families can read deleted game ids"
on public.game_catalog_tombstones for select to authenticated
using (true);

create function public.delete_game_catalog_entry(
  target_game_id text,
  target_catalog_status text,
  actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  has_active_version boolean;
  has_archived_version boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if not private.is_content_admin(actor_id) then
    raise exception 'content admin required';
  end if;
  if nullif(trim(target_game_id), '') is null then
    raise exception 'game id required';
  end if;
  if target_catalog_status not in ('published', 'archived') then
    raise exception 'unsupported catalog status';
  end if;
  if exists (
    select 1 from public.game_catalog_tombstones where game_id = target_game_id
  ) then
    raise exception 'game catalog entry not found';
  end if;

  select
    coalesce(bool_or(archived_at is null), false),
    coalesce(bool_or(archived_at is not null), false)
  into has_active_version, has_archived_version
  from public.published_game_versions
  where game_id = target_game_id;

  if target_catalog_status = 'archived' and (has_active_version or not has_archived_version) then
    raise exception 'archived game not found';
  end if;
  if target_catalog_status = 'published' and has_archived_version and not has_active_version then
    raise exception 'published game not found';
  end if;

  delete from public.published_game_versions
  where game_id = target_game_id;
  get diagnostics deleted_count = row_count;

  insert into public.game_catalog_tombstones (
    game_id,
    deleted_from_status,
    deleted_by
  ) values (
    target_game_id,
    target_catalog_status,
    actor_id
  );

  return deleted_count;
end;
$$;

create function private.clear_game_catalog_tombstone_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.game_catalog_tombstones where game_id = new.game_id;
  return new;
end;
$$;

create trigger clear_game_catalog_tombstone_on_publish
after insert on public.published_game_versions
for each row execute function private.clear_game_catalog_tombstone_on_publish();

revoke all on function public.delete_game_catalog_entry(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.delete_game_catalog_entry(text, text, uuid) to service_role;

comment on table public.game_catalog_tombstones is
  'Prevents a permanently deleted bundled game from reappearing through the mobile fallback catalog.';
comment on function public.delete_game_catalog_entry(text, text, uuid) is
  'Permanently deletes every published version of an active or archived game and records a fallback tombstone.';
