create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.parent_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  guardian_confirmed_at timestamptz not null,
  guardian_declaration_version text not null check (char_length(guardian_declaration_version) between 1 and 40),
  privacy_notice_version text not null check (char_length(privacy_notice_version) between 1 and 40),
  pin_configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.parent_pins (
  parent_id uuid primary key references public.parent_profiles (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_year smallint not null check (birth_year between 2000 and 2100),
  content_locale text not null default 'tr-TR' check (content_locale = 'tr-TR'),
  favorite_animals text[] not null default '{}'
    check (cardinality(favorite_animals) <= 10 and char_length(array_to_string(favorite_animals, ',')) <= 500),
  favorite_toys text[] not null default '{}'
    check (cardinality(favorite_toys) <= 10 and char_length(array_to_string(favorite_toys, ',')) <= 500),
  interests text[] not null default '{}'
    check (cardinality(interests) <= 10 and char_length(array_to_string(interests, ',')) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, parent_id)
);

create index child_profiles_parent_id_idx on public.child_profiles (parent_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger parent_profiles_set_updated_at
before update on public.parent_profiles
for each row execute function private.set_updated_at();

create trigger child_profiles_set_updated_at
before update on public.child_profiles
for each row execute function private.set_updated_at();

create function public.set_parent_pin(pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_parent_id uuid := auth.uid();
begin
  if current_parent_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if pin is null or pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must contain exactly four digits' using errcode = '22023';
  end if;

  if not exists (select 1 from public.parent_profiles where id = current_parent_id) then
    raise exception 'Parent onboarding required' using errcode = '42501';
  end if;

  insert into private.parent_pins (parent_id, pin_hash)
  values (current_parent_id, extensions.crypt(pin, extensions.gen_salt('bf', 10)))
  on conflict (parent_id) do update
    set pin_hash = excluded.pin_hash,
        updated_at = now();

  update public.parent_profiles
  set pin_configured_at = now()
  where id = current_parent_id;
end;
$$;

create function public.verify_parent_pin(pin text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from private.parent_pins
      where parent_id = auth.uid()
        and pin_hash = extensions.crypt(pin, pin_hash)
    ),
    false
  );
$$;

alter table public.parent_profiles enable row level security;
alter table public.child_profiles enable row level security;

revoke all on table public.parent_profiles from anon, authenticated;
revoke all on table public.child_profiles from anon, authenticated;
revoke all on function public.set_parent_pin(text) from public, anon;
revoke all on function public.verify_parent_pin(text) from public, anon;

grant select on table public.parent_profiles to authenticated;
grant insert (id, guardian_confirmed_at, guardian_declaration_version, privacy_notice_version)
  on table public.parent_profiles to authenticated;
grant select, insert, update, delete on table public.child_profiles to authenticated;
grant execute on function public.set_parent_pin(text) to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;

create policy "Parents can read their own parent profile"
on public.parent_profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Parents can create their own parent profile"
on public.parent_profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Parents can read their own child profiles"
on public.child_profiles
for select
to authenticated
using ((select auth.uid()) = parent_id);

create policy "Parents can create their own child profiles"
on public.child_profiles
for insert
to authenticated
with check ((select auth.uid()) = parent_id);

create policy "Parents can update their own child profiles"
on public.child_profiles
for update
to authenticated
using ((select auth.uid()) = parent_id)
with check ((select auth.uid()) = parent_id);

create policy "Parents can delete their own child profiles"
on public.child_profiles
for delete
to authenticated
using ((select auth.uid()) = parent_id);

comment on table public.parent_profiles is
  'Adult account metadata and versioned guardian declarations. Authentication lives in auth.users.';
comment on table public.child_profiles is
  'Minimal child personalization profile. Store no full birth date, diagnosis, audio, image, or legal name.';
comment on function public.verify_parent_pin(text) is
  'Verifies the local parent-area gate. It is not a replacement for Supabase account authentication.';
