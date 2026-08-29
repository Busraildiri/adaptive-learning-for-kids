create function public.delete_game_draft(target_game_id text, actor_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if not private.is_content_admin(actor_id) then
    raise exception 'content admin required';
  end if;

  delete from private.game_drafts
  where game_id = target_game_id;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'game draft not found';
  end if;
  return deleted_count;
end;
$$;

revoke all on function public.delete_game_draft(text, uuid) from public, anon, authenticated;
grant execute on function public.delete_game_draft(text, uuid) to service_role;

comment on function public.delete_game_draft(text, uuid) is
  'Permanently deletes only the pending draft for a game. Published versions are not changed.';
