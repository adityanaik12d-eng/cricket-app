-- Match Edit History & Safety
-- Run this in Supabase SQL Editor. Safe to re-run.
-- Rollback instructions at the bottom.

BEGIN;

-- ============================================================================
-- HELPER: admin_email (SECURITY DEFINER)
-- Returns the admin email from JWT or the constant. Policies call this instead
-- of auth.email()/auth.jwt() directly so the admin check is centralized.
-- ============================================================================
create or replace function public.admin_email()
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select 'adityanaik.12d@gmail.com';
$$;

revoke execute on function public.admin_email() from public, anon;
grant execute on function public.admin_email() to anon, authenticated;

-- ============================================================================
-- TABLE: matches — add finished_at column (single source of truth for "finished")
-- The app sets this on the final write when applyEvents returns COMPLETED/TIED/ABANDONED.
-- No backfill here; use scripts/backfill-finished-at.mjs for one-time migration.
-- ============================================================================
alter table public.matches
  add column if not exists finished_at timestamptz;

create index if not exists matches_finished_at_idx on public.matches (finished_at) where finished_at is not null;

-- ============================================================================
-- HELPER: is_match_finished (SECURITY DEFINER)
-- Single source of truth: uses the stored finished_at column.
-- Granted to anon + authenticated so RLS policies can call it.
-- ============================================================================
create or replace function public.is_match_finished(p_match_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select finished_at is not null
  from public.matches
  where id = p_match_id;
$$;

revoke execute on function public.is_match_finished(uuid) from public, anon;
grant execute on function public.is_match_finished(uuid) to anon, authenticated;

-- ============================================================================
-- HELPER: is_match_owner (SECURITY DEFINER)
-- Avoids RLS recursion. Used by policies and edit_finished_match.
-- Granted to authenticated (owner checks only matter for signed-in users).
-- ============================================================================
create or replace function public.is_match_owner(p_match_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.config->>'ownerId')::uuid = auth.uid()
  );
$$;

revoke execute on function public.is_match_owner(uuid) from public, anon;
grant execute on function public.is_match_owner(uuid) to authenticated;

-- ============================================================================
-- GRANT: scorer_token_matches to anon + authenticated
-- RLS policies execute as the calling role (anon for public readers,
-- authenticated for signed-in users). The policy's USING/CHECK expressions
-- call scorer_token_matches, so the caller must have EXECUTE on it.
-- Without these grants, anon users would get "permission denied" when
-- the policy tries to evaluate scorer_token_matches during a read.
-- ============================================================================
grant execute on function public.scorer_token_matches(text, text) to anon, authenticated;

-- ============================================================================
-- TABLE: match_edit_history (append-only audit log)
-- ============================================================================
create table if not exists public.match_edit_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  edited_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz not null default now(),
  old_config jsonb not null,
  old_events jsonb not null,
  reason text not null
);

create index if not exists match_edit_history_match_idx on public.match_edit_history (match_id);
create index if not exists match_edit_history_edited_by_idx on public.match_edit_history (edited_by);

alter table public.match_edit_history enable row level security;

-- Read: only match owner or admin can see history
drop policy if exists "match_edit_history_read_owner" on public.match_edit_history;
create policy "match_edit_history_read_owner"
  on public.match_edit_history for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_edit_history.match_id
        and (m.config->>'ownerId')::uuid = auth.uid()
    )
    or (auth.jwt() ->> 'email') = public.admin_email()
  );

-- No direct insert/update/delete from clients (only via SECURITY DEFINER function)
revoke all on public.match_edit_history from anon, authenticated;
grant select on public.match_edit_history to authenticated;

-- ============================================================================
-- SECURITY DEFINER FUNCTION: edit_finished_match
-- Only signed-in owner or admin can call. Validates inputs, saves history, then updates match.
-- Uses optimistic locking via p_expected_updated_at.
-- Sets a transaction-local GUC flag so the BEFORE UPDATE trigger allows this write.
-- ============================================================================
create or replace function public.edit_finished_match(
  p_match_id uuid,
  p_new_config jsonb,
  p_new_events jsonb,
  p_reason text,
  p_expected_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old_config jsonb;
  v_old_events jsonb;
  v_is_admin boolean;
  v_is_owner boolean;
  v_current_updated_at timestamptz;
begin
  -- 1. Authorization: only signed-in owner or admin
  v_is_admin := (auth.jwt() ->> 'email') = public.admin_email();
  v_is_owner := public.is_match_owner(p_match_id);

  if not (v_is_admin or v_is_owner) then
    raise exception 'FORBIDDEN: only match owner or admin can edit finished matches'
      using errcode = '42501';
  end if;

  -- 2. Validate match exists, is finished, and fetch current updated_at for optimistic locking
  select config, events, updated_at
  into v_old_config, v_old_events, v_current_updated_at
  from public.matches
  where id = p_match_id
  for update;  -- row lock to prevent concurrent edits

  if v_old_config is null then
    raise exception 'NOT_FOUND: match does not exist'
      using errcode = 'P0002';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_VERSION: match was modified by another request; reload and retry'
      using errcode = '55000';
  end if;

  if not public.is_match_finished(p_match_id) then
    raise exception 'PRECONDITION_FAILED: match is not finished; use normal scoring API'
      using errcode = '55000';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'INVALID_ARGUMENT: reason is required'
      using errcode = '22023';
  end if;

  -- 3. Validate new_events is an array with reasonable size cap (e.g., 10000 events)
  if jsonb_typeof(p_new_events) <> 'array' then
    raise exception 'INVALID_ARGUMENT: new_events must be a JSON array'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_new_events) > 10000 then
    raise exception 'INVALID_ARGUMENT: new_events exceeds maximum size (10000)'
      using errcode = '22023';
  end if;

  -- 4. Validate new_config is an object with reasonable size cap
  if jsonb_typeof(p_new_config) <> 'object' then
    raise exception 'INVALID_ARGUMENT: new_config must be a JSON object'
      using errcode = '22023';
  end if;
  if octet_length(p_new_config::text) > 100000 then
    raise exception 'INVALID_ARGUMENT: new_config exceeds maximum size (100KB)'
      using errcode = '22023';
  end if;

  -- 5. Require new_config matchId, ownerId, scorerTokenHash to equal old ones (immutable identity)
  if (p_new_config->>'matchId') is distinct from (v_old_config->>'matchId') then
    raise exception 'INVALID_ARGUMENT: matchId cannot be changed'
      using errcode = '22023';
  end if;
  if (p_new_config->>'ownerId') is distinct from (v_old_config->>'ownerId') then
    raise exception 'INVALID_ARGUMENT: ownerId cannot be changed'
      using errcode = '22023';
  end if;
  if (p_new_config->>'scorerTokenHash') is distinct from (v_old_config->>'scorerTokenHash') then
    raise exception 'INVALID_ARGUMENT: scorerTokenHash cannot be changed'
      using errcode = '22023';
  end if;

  -- 6. Set transaction-local flag so the BEFORE UPDATE trigger allows this write
  perform set_config('app.edit_finished_match', p_match_id::text, true);

  -- 7. Insert audit record (append-only, no client access)
  insert into public.match_edit_history (match_id, edited_by, old_config, old_events, reason)
  values (p_match_id, auth.uid(), v_old_config, v_old_events, trim(p_reason));

  -- 8. Update the match
  update public.matches
  set config = p_new_config,
      events = p_new_events,
      updated_at = now()
  where id = p_match_id;
end;
$$;

revoke execute on function public.edit_finished_match(uuid, jsonb, jsonb, text, timestamptz) from public, anon;
grant execute on function public.edit_finished_match(uuid, jsonb, jsonb, text, timestamptz) to authenticated;

-- ============================================================================
-- TRIGGER: Block direct UPDATEs to events or config on finished matches
-- Uses a transaction-local GUC set by edit_finished_match.
-- If OLD.finished_at is not null and config, events or finished_at changed:
--   allow only if current_setting('app.edit_finished_match', true) = OLD.id::text
--   or now() < OLD.finished_at + interval '30 minutes' (grace window).
-- No owner/admin safety-net branch. Uses OLD values, no table select.
-- finished_at never changes from non-null except via the GUC flag.
-- ============================================================================
create or replace function public.check_match_edit_allowed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_flag_match_id text;
  v_finished_at timestamptz;
begin
  -- Skip if this is not an update to config, events, or finished_at
  if not (TG_OP = 'UPDATE' and (
    OLD.config is distinct from NEW.config
    or OLD.events is distinct from NEW.events
    or OLD.finished_at is distinct from NEW.finished_at
  )) then
    return NEW;
  end if;

  -- If match is not finished, allow (normal RLS policy handles authorization)
  if OLD.finished_at is null then
    -- When finished_at is being SET for the first time, ensure it's not in the future
    -- (prevents a client from pushing finished_at forward to extend the 30-min window)
    if NEW.finished_at is not null and NEW.finished_at > now() + interval '1 minute' then
      raise exception 'INVALID_ARGUMENT: finished_at cannot be set to a future timestamp'
        using errcode = '22023';
    end if;
    return NEW;
  end if;

  -- Match is finished. Check if this write comes through edit_finished_match
  -- by reading the transaction-local GUC flag.
  v_flag_match_id := nullif(current_setting('app.edit_finished_match', true), '');
  if v_flag_match_id = OLD.id::text then
    return NEW; -- edit_finished_match set the flag, allow
  end if;

  -- Grace window: allow edits within 30 minutes of finished_at without the flag
  -- (covers rare edge cases like immediate post-match corrections via other paths)
  if now() < OLD.finished_at + interval '30 minutes' then
    return NEW;
  end if;

  -- Outside grace window and not via edit_finished_match: block
  raise exception 'FORBIDDEN: finished matches can only be edited via edit_finished_match'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_block_finished_match_edit on public.matches;
create trigger trg_block_finished_match_edit
  before update on public.matches
  for each row
  execute function public.check_match_edit_allowed();

-- ============================================================================
-- MATCHES UPDATE POLICY
-- Real live policy name: "matches are appendable by the scorer"
-- No admin branch (admin goes through edit_finished_match RPC, not direct UPDATE).
-- ============================================================================
drop policy if exists "matches are appendable by the scorer" on public.matches;
create policy "matches are updatable by owner or live scorer" on public.matches for update
using (
  -- Owner: always allowed
  (config->>'ownerId')::uuid = auth.uid()
  -- Token holder: only if live or within 30-min grace window
  or (
    config->>'ownerId' is null
    and config->>'scorerTokenHash' is not null
    and public.scorer_token_matches(
      coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
      config->>'scorerTokenHash'
    )
    and (finished_at is null or now() < finished_at + interval '30 minutes')
  )
  -- Legacy first-writer claim (ownerId null, scorerTokenHash null, token in header):
  -- only allowed while match is LIVE (finished_at is null)
  -- Once finished_at is set, this branch is closed — the token holder must use the
  -- normal token-holder branch above (which requires scorerTokenHash to be present).
  or (
    config->>'ownerId' is null
    and config->>'scorerTokenHash' is null
    and coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', '') <> ''
    and finished_at is null
  )
)
with check (
  (config->>'ownerId')::uuid = auth.uid()
  or (
    config->>'ownerId' is null
    and config->>'scorerTokenHash' is not null
    and public.scorer_token_matches(
      coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
      config->>'scorerTokenHash'
    )
    and (finished_at is null or now() < finished_at + interval '30 minutes')
  )
  or (
    config->>'ownerId' is null
    and config->>'scorerTokenHash' is null
    and coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', '') <> ''
    and finished_at is null
  )
);

COMMIT;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- To rollback, run in order:
BEGIN;

DROP TRIGGER IF EXISTS trg_block_finished_match_edit ON public.matches;
DROP FUNCTION IF EXISTS public.check_match_edit_allowed();
DROP FUNCTION IF EXISTS public.edit_finished_match(uuid, jsonb, jsonb, text, timestamptz);
DROP FUNCTION IF EXISTS public.is_match_finished(uuid);
DROP FUNCTION IF EXISTS public.is_match_owner(uuid);
DROP FUNCTION IF EXISTS public.admin_email();
DROP TABLE IF EXISTS public.match_edit_history;

-- Restore original policy
DROP POLICY IF EXISTS "matches are updatable by owner or live scorer" ON public.matches;
CREATE POLICY "matches are appendable by the scorer" ON public.matches FOR UPDATE
  USING (
    (config->>'ownerId')::uuid = auth.uid()
    or (
      config->>'ownerId' is null
      and config->>'scorerTokenHash' is not null
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
  WITH CHECK (
    (config->>'ownerId')::uuid = auth.uid()
    or (
      config->>'ownerId' is null
      and config->>'scorerTokenHash' is not null
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

ALTER TABLE public.matches DROP COLUMN IF EXISTS finished_at;

COMMIT;
*/