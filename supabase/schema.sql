-- Cricket Scorer — Supabase schema.
--
-- One row per match: `config` is the match setup, `events` is the append-only
-- ball-by-ball log. The score, scorecard and commentary are computed in the
-- browser by @cricket-app/core, so there is no other table to keep in sync.
--
-- Run this once: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run more than once.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  config jsonb not null,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A match link is public: anyone who has it can read the match, and anyone can
-- create a match or append to one. There is no login in v1, so RLS is permissive.
alter table public.matches enable row level security;

drop policy if exists "matches are readable by anyone" on public.matches;
create policy "matches are readable by anyone"
  on public.matches for select
  using (true);

drop policy if exists "matches are creatable by anyone" on public.matches;
create policy "matches are creatable by anyone"
  on public.matches for insert
  with check (true);

drop policy if exists "matches are appendable by anyone" on public.matches;
create policy "matches are appendable by anyone"
  on public.matches for update
  using (true)
  with check (true);

grant select, insert, update on public.matches to anon, authenticated;

-- Push row updates to every open viewer so shared links stay live (Realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
