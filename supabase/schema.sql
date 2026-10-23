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

-- Scorer ownership: a match may be owned by a signed-in user (owner_id in
-- config) and/or by a device holding the scorer token (scorerTokenHash in
-- config). A write is allowed when either gate passes; legacy rows with
-- neither are claimable by the first writer.
create or replace function public.scorer_token_matches(p_token text, p_hash text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p_token is not null
     and p_token <> ''
     and encode(digest(p_token, 'sha256'), 'hex') = p_hash;
$$;

drop policy if exists "matches are appendable by anyone" on public.matches;
drop policy if exists "matches are appendable by the scorer" on public.matches;
create policy "matches are appendable by the scorer"
  on public.matches for update
  using (
    (config->>'ownerId')::uuid = auth.uid()
    or (
      config->>'ownerId' is null
      and public.scorer_token_matches(
        coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
        config->>'scorerTokenHash'
      )
    )
    or (
      config->>'ownerId' is null
      and config->>'scorerTokenHash' is null
      and coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', '') <> ''
    )
  )
  with check (
    (config->>'ownerId')::uuid = auth.uid()
    or (
      config->>'ownerId' is null
      and public.scorer_token_matches(
        coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
        config->>'scorerTokenHash'
      )
    )
    or (
      config->>'ownerId' is null
      and config->>'scorerTokenHash' is null
      and coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', '') <> ''
    )
  );

grant select, insert, update, delete on public.matches to anon, authenticated;

-- Delete: only the signed-in owner can delete their own matches. Watchers and
-- anon users (and anyone holding only a scorer token) cannot delete anything.
drop policy if exists "matches are deletable by the owner" on public.matches;
create policy "matches are deletable by the owner"
  on public.matches for delete
  using (
    (config->>'ownerId')::uuid = auth.uid()
  );

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
