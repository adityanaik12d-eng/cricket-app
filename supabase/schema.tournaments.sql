-- Cricket Scorer: Tournament schema (best-effort / Phase 1+ bulk foundation)
-- Run in Supabase SQL Editor. Safe to review before applying.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  description text,
  city text,
  state text,
  country text default 'India',
  category text not null default 'OPEN',
  format text not null default 'league',
  status text not null default 'draft',
  match_type text not null default 'T20',
  ball_type text not null default 'leather_white',
  overs_per_innings int not null default 20,
  start_date date,
  end_date date,
  organizer_name text,
  organizer_user_id uuid references auth.users(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  short_name text,
  logo_url text,
  group_name text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  group_name text,
  round text default 'League',
  match_number int,
  team1_id uuid references public.tournament_teams(id) on delete set null,
  team2_id uuid references public.tournament_teams(id) on delete set null,
  team1_name text,
  team2_name text,
  ground_name text,
  scheduled_at timestamptz,
  status text not null default 'scheduled',
  result jsonb, -- { winnerTeamId, margin, team1: {runs,overs,wkts,allOut}, team2: {...} }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tournament_teams_tid on public.tournament_teams(tournament_id);
create index if not exists idx_tournament_fixtures_tid on public.tournament_fixtures(tournament_id);
create index if not exists idx_tournament_fixtures_match on public.tournament_fixtures(match_id);

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_fixtures enable row level security;

-- Read: public (tournament links shareable)
drop policy if exists "tournaments readable" on public.tournaments;
create policy "tournaments readable" on public.tournaments for select using (true);
drop policy if exists "tournament_teams readable" on public.tournament_teams;
create policy "tournament_teams readable" on public.tournament_teams for select using (true);
drop policy if exists "tournament_fixtures readable" on public.tournament_fixtures;
create policy "tournament_fixtures readable" on public.tournament_fixtures for select using (true);

-- Write: authenticated users can create; organizers/admin can update/delete (best-effort)
drop policy if exists "tournaments insert auth" on public.tournaments;
create policy "tournaments insert auth" on public.tournaments for insert to authenticated with check (true);
drop policy if exists "tournaments update owner" on public.tournaments;
create policy "tournaments update owner" on public.tournaments for update using (organizer_user_id = auth.uid() or auth.email() = 'adityanaik.12d@gmail.com');
drop policy if exists "tournament_teams write" on public.tournament_teams;
create policy "tournament_teams write" on public.tournament_teams for all to authenticated using (true) with check (true);
drop policy if exists "tournament_fixtures write" on public.tournament_fixtures;
create policy "tournament_fixtures write" on public.tournament_fixtures for all to authenticated using (true) with check (true);

grant select on public.tournaments, public.tournament_teams, public.tournament_fixtures to anon, authenticated;
grant insert, update, delete on public.tournaments, public.tournament_teams, public.tournament_fixtures to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tournaments') then
    alter publication supabase_realtime add table public.tournaments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tournament_fixtures') then
    alter publication supabase_realtime add table public.tournament_fixtures;
  end if;
end $$;
