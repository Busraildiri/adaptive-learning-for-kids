alter table public.published_game_versions
add column archived_at timestamptz,
add column archived_by uuid references auth.users(id);

drop policy "Signed-in families can read published games" on public.published_game_versions;
create policy "Signed-in families can read active published games"
on public.published_game_versions for select to authenticated
using (archived_at is null);

create index published_game_versions_active_age_idx
on public.published_game_versions (age_band, published_at desc)
where archived_at is null;

create or replace function public.list_game_catalog(actor_id uuid)
returns table (
  game_id text,
  game_version integer,
  catalog_status text,
  age_band text,
  game jsonb,
  updated_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;

  return query
  with latest_published as (
    select distinct on (published.game_id)
      published.game_id,
      published.game_version,
      case when published.archived_at is null then 'published' else 'archived' end as catalog_status,
      published.age_band,
      published.game,
      coalesce(published.archived_at, published.published_at) as updated_at
    from public.published_game_versions published
    order by published.game_id, published.game_version desc
  )
  select draft.game_id, draft.game_version, 'draft'::text, draft.age_band, draft.game,
    draft.updated_at
  from private.game_drafts draft
  union all
  select latest.game_id, latest.game_version, latest.catalog_status, latest.age_band, latest.game,
    latest.updated_at
  from latest_published latest
  order by updated_at desc;
end;
$$;

create or replace function public.archive_published_game(target_game_id text, actor_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare archived_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(actor_id) then raise exception 'content admin required'; end if;

  update public.published_game_versions
  set archived_at = now(), archived_by = actor_id
  where game_id = target_game_id and archived_at is null;
  get diagnostics archived_count = row_count;
  if archived_count = 0 then raise exception 'active published game not found'; end if;
  return archived_count;
end;
$$;

revoke all on function public.list_game_catalog(uuid) from public, anon, authenticated;
revoke all on function public.archive_published_game(text, uuid) from public, anon, authenticated;
grant execute on function public.list_game_catalog(uuid) to service_role;
grant execute on function public.archive_published_game(text, uuid) to service_role;

comment on function public.archive_published_game(text, uuid) is
  'Archives every active version for a game so mobile clients never fall back to an older version.';
