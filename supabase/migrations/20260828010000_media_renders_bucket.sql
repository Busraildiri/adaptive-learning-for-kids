-- Private storage bucket for rendered media job output. No RLS policies are
-- added for anon/authenticated -- Storage RLS is deny-by-default, so only
-- service_role (which bypasses RLS) can read/write here. media-worker
-- uploads and mints a short-lived signed URL for admin-web to display.
insert into storage.buckets (id, name, public)
values ('media-renders', 'media-renders', false)
on conflict (id) do nothing;
