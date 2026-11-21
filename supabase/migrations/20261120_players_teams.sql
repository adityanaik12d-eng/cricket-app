-- Players & Teams feature — Migration
-- Run this in Supabase SQL Editor. Safe to re-run.
-- Rollback instructions at the bottom.

-- ============================================================================
-- HELPER FUNCTIONS (no table dependencies)
-- ============================================================================

-- Normalise mobile: keep only digits
create or replace function public.normalise_mobile(p_mobile text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g');
$$;

-- Mask mobile for search results (safe for short numbers)
create or replace function public.mask_mobile(p_mobile text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when p_mobile is null then null
    when length(normalise_mobile(p_mobile)) <= 4 then repeat('*', length(normalise_mobile(p_mobile)))
    else regexp_replace(normalise_mobile(p_mobile), '^(.{2}).*(.{2})$', '\1****\2')
  end;
$$;

-- ============================================================================
-- TABLES (created before any function that references them)
-- ============================================================================

-- TABLE: players
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  is_guest boolean not null default false,
  created_at timestamptz not null default now()
);

-- Unique index on normalised mobile (non-empty only)
create unique index if not exists players_mobile_unique
  on public.players (normalise_mobile(mobile))
  where mobile is not null and normalise_mobile(mobile) <> '';

-- Indexes for search
create index if not exists players_name_idx on public.players (lower(name));
create index if not exists players_user_id_idx on public.players (user_id) where user_id is not null;
create index if not exists players_created_by_idx on public.players (created_by) where created_by is not null;

alter table public.players enable row level security;

-- TABLE: teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  colour text not null default '#3b82f6',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists teams_created_by_idx on public.teams (created_by) where created_by is not null;

alter table public.teams enable row level security;

-- TABLE: team_members
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'member' check (role in ('captain','vice','member')),
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  primary key (team_id, player_id)
);

create index if not exists team_members_player_idx on public.team_members (player_id);

alter table public.team_members enable row level security;

-- ============================================================================
-- HELPER: is_team_manager (SECURITY DEFINER to avoid RLS recursion)
-- Returns true if the current user is the team creator or a captain/vice.
-- Must be defined before policies that reference it.
-- ============================================================================
create or replace function public.is_team_manager(p_team_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and t.created_by = auth.uid()
  )
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.player_id in (
        select id from public.players where user_id = auth.uid()
      )
      and tm.role in ('captain','vice')
  );
$$;

revoke execute on function public.is_team_manager(uuid) from public, anon;
grant execute on function public.is_team_manager(uuid) to authenticated;

-- ============================================================================
-- POLICIES AND GRANTS FOR ALL THREE TABLES
-- ============================================================================

-- --- players ---
revoke all on public.players from anon, authenticated;
grant select (id, name, is_guest, user_id, created_at) on public.players to authenticated;
grant insert (name, is_guest, created_by) on public.players to authenticated;
grant update (name) on public.players to authenticated;

drop policy if exists "players_read_authenticated" on public.players;
create policy "players_read_authenticated"
  on public.players for select
  to authenticated
  using (true);

drop policy if exists "players_insert_guest_only" on public.players;
create policy "players_insert_guest_only"
  on public.players for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and user_id is null
    and mobile is null
    and email is null
    and is_guest = true
  );

drop policy if exists "players_update_name_only" on public.players;
create policy "players_update_name_only"
  on public.players for update
  to authenticated
  using (
    (is_guest and created_by = auth.uid())
    or (user_id = auth.uid())
  )
  with check (
    (is_guest and created_by = auth.uid())
    or (user_id = auth.uid())
  );

drop policy if exists "players_delete_guest_creator" on public.players;
create policy "players_delete_guest_creator"
  on public.players for delete
  to authenticated
  using (is_guest and created_by = auth.uid());

-- --- teams ---
revoke all on public.teams from anon, authenticated;
grant select on public.teams to authenticated;
grant insert (name, short_name, colour, created_by) on public.teams to authenticated;
grant update (name, short_name, colour) on public.teams to authenticated;
grant delete on public.teams to authenticated;

drop policy if exists "teams_read_authenticated" on public.teams;
create policy "teams_read_authenticated"
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists "teams_insert_authenticated" on public.teams;
create policy "teams_insert_authenticated"
  on public.teams for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "teams_update_manager" on public.teams;
create policy "teams_update_manager"
  on public.teams for update
  to authenticated
  using (public.is_team_manager(id))
  with check (public.is_team_manager(id));

drop policy if exists "teams_delete_creator" on public.teams;
create policy "teams_delete_creator"
  on public.teams for delete
  to authenticated
  using (created_by = auth.uid());

-- --- team_members ---
revoke all on public.team_members from anon, authenticated;
grant select on public.team_members to authenticated;
grant insert (team_id, player_id, role, added_by) on public.team_members to authenticated;
grant update (role) on public.team_members to authenticated;
grant delete on public.team_members to authenticated;

drop policy if exists "team_members_read_authenticated" on public.team_members;
create policy "team_members_read_authenticated"
  on public.team_members for select
  to authenticated
  using (true);

drop policy if exists "team_members_insert_manager" on public.team_members;
create policy "team_members_insert_manager"
  on public.team_members for insert
  to authenticated
  with check (
    public.is_team_manager(team_id)
    and added_by = auth.uid()
  );

drop policy if exists "team_members_update_manager" on public.team_members;
create policy "team_members_update_manager"
  on public.team_members for update
  to authenticated
  using (public.is_team_manager(team_id))
  with check (public.is_team_manager(team_id));

drop policy if exists "team_members_delete_manager" on public.team_members;
create policy "team_members_delete_manager"
  on public.team_members for delete
  to authenticated
  using (public.is_team_manager(team_id));

-- ============================================================================
-- SEARCH RPC: search_players
-- name: partial match (ILIKE with escaped %, _), min 3 chars
-- mobile: EXACT match on last 10 digits (normalised), needs at least 8 digits
-- email: EXACT match, case-insensitive
-- returns: id, name, is_guest, masked_mobile
-- ============================================================================
create or replace function public.search_players(
  q text,
  max_results int default 20
)
returns table (
  id uuid,
  name text,
  is_guest boolean,
  masked_mobile text
)
language sql
security definer
set search_path = public, extensions
as $$
  with params as (
    select
      q as raw_q,
      replace(replace(q, '%', '\%'), '_', '\_') as safe_q,
      normalise_mobile(q) as norm_mobile
  )
  select
    p.id,
    p.name,
    p.is_guest,
    mask_mobile(p.mobile) as masked_mobile
  from public.players p, params
  where (
        length(params.safe_q) >= 3
        and p.name ilike '%' || params.safe_q || '%' escape '\'
      )
      or (
        length(params.norm_mobile) >= 8
        and p.mobile is not null
        and right(normalise_mobile(p.mobile), 10) = right(params.norm_mobile, 10)
      )
      or (
        p.email is not null
        and lower(p.email) = lower(params.raw_q)
      )
  order by
    case when p.name ilike params.safe_q || '%' escape '\' then 0 else 1 end,
    case when p.is_guest then 1 else 0 end,
    p.name
    limit least(max_results, 20);
$$;

revoke execute on function public.search_players(text, int) from public, anon;
grant execute on function public.search_players(text, int) to authenticated;

-- ============================================================================
-- TRIGGER: auto-create player row when a profile is created
-- SECURITY DEFINER so it runs with elevated privileges
-- Swallows unique_violation so profile creation is never blocked
-- ============================================================================
create or replace function public.create_player_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.players (id, name, mobile, email, user_id, created_by, is_guest)
  values (
    new.id,
    coalesce(nullif(new.name, ''), 'Player'),
    nullif(normalise_mobile(new.mobile), ''),
    nullif(lower(new.email), ''),
    new.id,
    new.id,
    false
  )
  on conflict do nothing;
  return new;
exception
  when unique_violation then
    return new;
end;
$$;

drop trigger if exists profiles_create_player on public.profiles;
create trigger profiles_create_player
  after insert on public.profiles
  for each row
  execute function public.create_player_from_profile();

revoke execute on function public.create_player_from_profile() from public;

-- ============================================================================
-- BACKFILL: from public.profiles (run separately after migration)
-- NULLIF empty strings, plain ON CONFLICT DO NOTHING
-- ============================================================================
/*
-- Run this block manually after the migration:
insert into public.players (id, name, mobile, email, user_id, created_by, is_guest)
select
  p.id,
  coalesce(nullif(p.name, ''), 'Player'),
  nullif(normalise_mobile(p.mobile), ''),
  nullif(lower(p.email), ''),
  p.id,
  p.id,
  false
from public.profiles p
where p.id is not null
on conflict do nothing;
*/

-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- To rollback, run in order:
drop table if exists public.team_members;
drop table if exists public.teams;
drop table if exists public.players;
drop trigger if exists profiles_create_player on public.profiles;
drop function if exists public.create_player_from_profile();
drop function if exists public.search_players(text, int);
drop function if exists public.is_team_manager(uuid);
drop function if exists public.mask_mobile(text);
drop function if exists public.normalise_mobile(text);
*/