# Plan — Scorer vs Watcher: scoring authority + a dedicated watcher view

**Status:** approved by the user on 2026-10-21 ("the watcher is able to add the per ball
score which should be only visible to the scorer not to the watcher, and make a separate
good scoring view for watchers").

**Context:** Phases 1–4 of the UI redesign shipped and are live at
`https://cricket-scorer-gold.vercel.app`. A shared match link
(`#/match/<id>`) currently opens the **scoring pad for everybody**, and the Supabase RLS
policy `matches are appendable by anyone` lets *any* holder of the link append events to
the match row. The watcher must be a spectator: read the score, never change it.

**Repo:** `C:\Users\IT\cricket-app` — branch `master`, no worktree, PowerShell.
**Baseline commit:** `d39666e`.

---

## Global constraints

1. **No production code without a failing test first** (TDD).
2. `packages/core` is the shared pure-logic package; the web app consumes it through
   `dist/`, so **core must be built before web typecheck/tests** (vitest does not typecheck).
3. New `BallEvent` fields stay **optional** so old matches still load.
4. Plain CSS only — one stylesheet, `web/src/index.css`.
5. Animate only `transform` / `opacity`; respect `prefers-reduced-motion`.
6. Works at 360px and desktop, light and dark; no horizontal overflow.
7. Every write path must keep working **whether or not** the new Supabase SQL has been
   applied by the user — the app must degrade, never break.

## Task 1 — `web/src/ownership.ts` (scorer identity + token store)

Pure-ish module, no React:

- `scorerTokensKey` = `'cricket.scorerTokens'` → `Record<matchId, token>`.
- `createScorerToken(random?)` → 32 hex chars.
- `readScorerToken(matchId, store?)` → token | null. Never throws.
- `storeScorerToken(matchId, token, store?)` → void. Never throws.
- `hashScorerToken(token)` → `string` — lowercase hex SHA-256 from a **pure TypeScript**
  implementation (`sha256Hex`, verified against known test vectors), so it works without
  `crypto.subtle` (e.g. insecure contexts) and stays synchronously testable.
- `isScorerMatch(matchId, store?)` → true when a token exists **or** the match id is in
  the legacy `cricket.myMatches` list (matches created before tokens existed).
- `legacyMatchIds(store?)` → ids from `cricket.myMatches`.

Tests: `web/src/ownership.test.ts` (fake store, no globals touched).

## Task 2 — write path carries the scorer token

`web/src/api.ts`:

- Every write (`postEvent`, `undoLast`, `patchEventShot`) sends the header
  `x-scorer-token: <token>` when a token exists for that match.
- `api.claimScoring(matchId, token)` → writes the hash into the row's **`config` JSONB**
  (`config.scorerTokenHash`).
  **Best effort**: a missing hash key or an old RLS policy must not fail the call.
- `api.readScorerHash(matchId)` → the stored hash or `null` (best effort; reads `config`).

## Task 3 — claim ownership on creation

`web/src/App.tsx`: after `api.createMatch` succeeds, mint a token, store it, and call
`api.claimScoring`. Also: when a match is opened and the browser already owns it
(legacy list) but has no token, mint + claim it.

## Task 4 — `web/src/ui/WatcherView.tsx` (the watcher's view)

A dedicated broadcast-style read-only view: live score hero (runs/wickets/overs, CRR,
target/RRR), this-over ball strip, the over timeline, a mini scorecard and the live
commentary feed. No pad, no undo, no placement picker, no innings controls.

Tests: `web/src/ui/WatcherView.test.tsx` with `renderToStaticMarkup`.

## Task 5 — wire the split into `ScoringScreen.tsx`

- `isScorer` decides the tab set: scorer → `Scoring / Report / Scorecard / Wheel /
  Charts`; watcher → `Watch / Report / Scorecard / Wheel / Charts`.
- A watcher landing on `#/match/<id>` gets the **Watch** tab, never the pad.
- Hide Undo, the placement toggle and the New-innings card from watchers.

## Task 6 — CSS for the watcher view

`.watch-*` block in `web/src/index.css`, reusing the existing tokens.

## Task 7 — Supabase SQL (shown to the user, not applied by me)

The anon key cannot run DDL, so the user pastes this into the Supabase SQL editor.

**Ruling (design change):** the token hash lives in the **existing `config` JSONB column**
(`config->>'scorerTokenHash'`), *not* in a new `scorer_token_hash` column. A new column made
the app probe `select=scorer_token_hash`, which returns **HTTP 400** before the ALTER TABLE
is applied → a console error on every match load. Storing it in `config` needs no DDL, never
errors, and the user's SQL shrinks to a policy + a helper function.

```sql
create extension if not exists pgcrypto;

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

create policy "matches are appendable by the scorer" on public.matches
  for update
  using (
    public.scorer_token_matches(
      coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
      config->>'scorerTokenHash'
    )
    or (
      config->>'scorerTokenHash' is null
      and coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', '') <> ''
    )
  )
  with check (
    public.scorer_token_matches(
      coalesce(current_setting('request.headers', true)::json->>'x-scorer-token', ''),
      config->>'scorerTokenHash'
    )
  );
```

Notes on the SQL:
- `security definer` + `set search_path = public, extensions` lets the function reach
  `digest` without the `anon` role needing EXECUTE on `pgcrypto`.
- `encode(digest(...), 'hex')` produces lowercase hex — the same encoding the browser's
  SHA-256 (`hashScorerToken`) produces, so both sides agree.
- PostgREST exposes custom request headers to SQL through
  `current_setting('request.headers', true)::json->>'x-scorer-token'` (header names are
  lower-cased).

**Known limitation (must be stated to the user):** a legacy row with no
`config.scorerTokenHash` can be claimed by the first writer that sends *any*
`x-scorer-token` header. The owner browser claims it automatically on the next open after
the SQL is applied; a watcher who writes first would take control (and the owner browser
would then show "scoring control is held by another device"). Reset a stuck row with:

```sql
update public.matches set config = config - 'scorerTokenHash' where id = '<match-id>';
```

## Task 8 — verify

`npm run build -w @cricket-app/core` → `npm run test -w @cricket-app/core` →
`npm run test -w @cricket-app/web` → `npm run typecheck -w @cricket-app/web` →
`npm run build -w @cricket-app/web`. Then Playwright at 360px + desktop, dark + light:
scorer sees the pad, watcher sees the watch view, **zero console errors**.

## Task 9 — deploy + live verification

Deploy the built `web/dist` (recipe in `DEPLOY.md` section 0) and verify on
`https://cricket-scorer-gold.vercel.app`.

---

## Follow-on

The Phase 5 + Phase 6 plan (`docs/superpowers/plans/2026-10-21-celebrations-and-beehive.md`)
is still to be executed after this one.
