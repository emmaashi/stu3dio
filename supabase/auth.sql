-- Stu3dio accounts. Run once in the Supabase SQL editor for the project whose
-- URL and anon key the frontend uses (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).
--
-- Email + password sign-in comes from Supabase Auth. This adds usernames, a
-- display name and per-user settings, and keeps emails unique across accounts.
-- In Authentication → Providers → Email, turn OFF "Confirm email" if you want
-- new accounts to be usable immediately (the app handles both modes).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by their owner" on public.profiles;
create policy "profiles are readable by their owner"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles are editable by their owner" on public.profiles;
create policy "profiles are editable by their owner"
  on public.profiles for update using (auth.uid() = id);

-- Create the profile row when a user signs up; the username comes from the
-- sign-up metadata the app sends.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested text := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, email, username, display_name)
  values (new.id, lower(new.email), requested, coalesce(new.raw_user_meta_data ->> 'display_name', requested));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Anonymous callers may ask two narrow questions without reading the table.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not exists (select 1 from public.profiles where username = lower(candidate));
$$;

create or replace function public.email_for_username(candidate text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.profiles where username = lower(candidate) limit 1;
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.email_for_username(text) to anon, authenticated;
