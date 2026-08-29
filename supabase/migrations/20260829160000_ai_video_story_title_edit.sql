-- Lets an admin correct an AI video story's title without regenerating any
-- media. Only touches ai_video_story_requests.plan.title (the admin
-- catalog's own draft data) -- if the story is already published, the live
-- published_story_experiences row is a frozen copy from finalize time and
-- is NOT updated by this; that would need a separate republish action.

create or replace function public.update_ai_video_story_title(
  target_actor_id uuid, target_request_id uuid, new_title text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  trimmed_title text := trim(new_title);
  updated_plan jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  if not private.is_content_admin(target_actor_id) then raise exception 'content admin required'; end if;
  if char_length(trimmed_title) not between 1 and 120 then
    raise exception 'title must be 1-120 characters';
  end if;

  update private.ai_video_story_requests
    set plan = jsonb_set(plan, '{title}', to_jsonb(trimmed_title), true), updated_at = now()
    where id = target_request_id and created_by = target_actor_id
    returning plan into updated_plan;
  if not found then raise exception 'AI video story request not found'; end if;

  return updated_plan;
end;
$$;

revoke all on function public.update_ai_video_story_title(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_ai_video_story_title(uuid, uuid, text) to service_role;

comment on function public.update_ai_video_story_title(uuid, uuid, text) is
  'Admin-only title correction for an AI video story draft. Does not touch
   any already-published experience -- that is a separate, frozen copy.';
