-- Admin portal schema: profiles (1:1 auth.users) + audit log.
-- Run after supabase/schema.sql in Supabase SQL Editor. Safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  mobile text,
  role text,
  batting_hand text,
  bowling_style text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_name_idx on public.profiles (lower(name));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles for update
  using (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com')
  with check (auth.uid() = id or auth.email() = 'adityanaik.12d@gmail.com');

-- Inserts/privileged admin edits are performed by service-role Edge Functions.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_select_creator" on public.admin_audit_log;
create policy "admin_audit_select_creator" on public.admin_audit_log for select
  using (auth.email() = 'adityanaik.12d@gmail.com');

-- Inserts via service-role Edge Functions only.

-- Best-effort backfill from existing auth.users metadata (run manually if desired).
-- insert into public.profiles (id, email, name, mobile, role)
-- select id, email, raw_user_meta_data->>'name',
--        coalesce(raw_user_meta_data->>'mobile', phone),
--        raw_user_meta_data->>'role'
-- from auth.users
-- on conflict (id) do update set
--   email = excluded.email,
--   name = coalesce(public.profiles.name, excluded.name),
--   mobile = coalesce(public.profiles.mobile, excluded.mobile),
--   role = coalesce(public.profiles.role, excluded.role);
