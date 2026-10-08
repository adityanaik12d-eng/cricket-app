# Accounts, Player Profiles & Player Directory — Design Spec

**Date:** 2026-10-08
**Status:** Approved (design reviewed in chat; spec awaiting user review)
**Depends on:** `docs/specs/2026-10-07-cricket-app-design.md` (base app: engine, API, web UI — all built and e2e-verified)

## Goal

Let players have a real identity — a mobile-number account with an editable
cricket profile — and let scorers add players to a lineup either by name
(fast, no account) or by mobile number (pulls the saved profile). Career
stats accumulate across matches and are shown **free** (CricHeroes gates
similar detail behind a paid PRO tier; we do not have paid tiers).

User's requirement, verbatim: *"i want to add players by the name or they can
create their account and i just to add them by adding their mobile number."*

## Constraints (agreed with user)

- **OTP delivery: dev mode now, SMS later.** The 6-digit code is returned in
  the OTP-request response and logged to the server console. An SMS provider
  (MSG91/Twilio) plugs in later behind the same function; no keys this phase.
- **Storage: SQLite via Node's built-in `node:sqlite`.** Single file
  `cricket.db`. Zero install. All SQL kept standard so a Postgres migration
  stays possible.
- **Everything CricHeroes charges PRO for in stats is free here.**
- Scoring must work fully **without** signing in (manual/by-name players).
- VCL content on the user's CricHeroes account is off-limits; our app has no
  VCL data at all — this is read-only reference only.
- TDD: every production change lands with a failing test first.

## Data model (SQLite)

New file `server/src/db.ts` opens/creates `cricket.db` (path from `DB_PATH`
env, default `./cricket.db`) and runs idempotent `CREATE TABLE IF NOT EXISTS`.

```sql
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,          -- 'p-<uuid>'
  mobile        TEXT NOT NULL UNIQUE,      -- digits only, identity key
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('BATSMAN','BOWLER','KEEPER','ALL_ROUNDER')),
  batting_hand  TEXT NOT NULL DEFAULT 'RHB' CHECK (batting_hand IN ('RHB','LHB')),
  bowling_style TEXT,                      -- NULL allowed (e.g. 'Right-arm medium')
  location      TEXT,
  created_at    TEXT NOT NULL              -- ISO string
);

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_events (
  match_id     TEXT NOT NULL REFERENCES matches(id),
  seq          INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  ts           TEXT NOT NULL,
  PRIMARY KEY (match_id, seq)
);

CREATE TABLE IF NOT EXISTS otp_codes (
  mobile     TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);
```

`players.role` covers the four CricHeroes roles (Batsman / Bowler /
Wicketkeeper / All-Rounder; user's wording "batting, bowling and keeping
player type").

**Match store migration:** `MatchStore` reads its initial state from
`match_events` on boot (replay via `applyEvents`) and appends to
`match_events` (plus a `matches` row on create) instead of an in-memory map.
Behavior of `append` (seq assignment, assign-after-clean-apply, `update`
event) is unchanged. Result: matches survive server restarts.

## Auth

| Endpoint | Body | Returns | Errors |
|---|---|---|---|
| `POST /auth/otp` | `{mobile}` | `{ok:true, devOtp}` — `devOtp` present **only** while `OTP_PROVIDER=dev` (default) | 400 `INVALID_MOBILE` (not 10 digits) |
| `POST /auth/verify` | `{mobile, otp}` | `{token, player}` | 404 `OTP_NOT_FOUND`, 400 `OTP_EXPIRED` (5 min), 400 `OTP_MAX_ATTEMPTS` (3), 400 `OTP_MISMATCH`, 404 `NO_ACCOUNT` (number has no player profile — sign-up completes by passing `name` too) |
| `POST /auth/register` | `{mobile, otp, name}` | `{token, player}` | same OTP errors; creates the player row with defaults (`role='BATSMAN'`, `batting_hand='RHB'`) |
| `GET /me` | — | `{player}` | 401 `UNAUTHENTICATED` |
| `PATCH /me` | `{name?, role?, batting_hand?, bowling_style?, location?}` | `{player}` | 400 `INVALID_PROFILE` (bad enum/empty), 401 |

- Token: JWT HS256, 30-day expiry, `JWT_SECRET` env (dev default
  `dev-secret-change-me` so tests/first run work without setup). Sent as
  `Authorization: Bearer <token>`.
- OTP: 6 digits, 5-minute expiry, 3 attempts max then invalidated, one
  active code per mobile (new request overwrites).
- Dev provider logs `OTP <code> for <mobile>` to the server console and
  returns `devOtp`. SMS later: same `sendOtp(mobile, code)` seam.

## Player directory (scorer-facing)

| Endpoint | Query/Body | Returns |
|---|---|---|
| `GET /players` | `?q=` — digits (prefix-match on mobile) or text (case-insensitive name prefix) | `{players: PlayerSummary[]}` (max 10) |
| `GET /players/:id/stats` | — | career stats (below) |
| `POST /players` | `{mobile, name}` | 201 `{player}` — create with number (used when lookup finds nothing); 409 `MOBILE_TAKEN` |

Lineup entry rules (web setup flow):
- **Add by name** → immediate local entry with a generated id (current
  behavior); no account required; shows as "unverified" (no number linked).
- **Add by number** → type ≥ 4 digits → typeahead calls `GET /players?q=`
  → tapping a result stores that `playerId` in the lineup. No match → offer
  "Add '<number>' as new player" with a name field → `POST /players`.
- Match config's lineups gain an optional parallel `playerRefs` map
  `{ [playerId]: {name, mobile?, verified} }`. Lineups keep storing player
  ids and events keep referencing them — no engine change; display names
  resolve from `playerRefs` at render time, so id-only lineups (existing
  matches) still render exactly as today. `verified: true` iff the id came
  from a directory lookup (number registered); `false` for by-name adds.

## Career stats

`GET /players/:id/stats` folds every stored match's events
(`applyEvents` replay; corrections already handled by the fold):

```json
{
  "matches": 12, "runs": 214, "balls": 180, "fours": 19, "sixes": 7,
  "highest": 48, "notOuts": 4,
  "wickets": 9, "oversBowled": "38.2", "runsConceded": 210, "bestBowling": "3/14",
  "catches": 5, "stumpings": 1, "runOuts": 2,
  "batting":  { "innings": 11, "average": 23.78, "strikeRate": 118.89 },
  "bowling":  { "economy": 5.48, "average": 23.33 },
  "fielding": { "dismissals": 8 }
}
```

A player appears in a match's batting/bowling/fielding counts when their
id (via `playerRefs` or lineup id) is the batter, bowler, or credited
fielder in any event of that match. All returned numbers formatted
(economy/average/SR to 2 dp; doubles are computed, not rounded early).

**Fielder attribution (small engine addition):** wicket `BallEvent`s gain an
optional `fielderId` — the catcher for `CAUGHT`, the keeper for `STUMPED`,
the fielder for `RUN_OUT`, bowler-side fielder for `OBSTRUCTING` (default
`fieldingCaptainId` when unset, so old events still fold). The web
dismissal picker gains a "fielded by" select for those dismissals (defaults
to sensible candidates: non-bowler fielders / keeper). Fielding stats:
catches = `fielderId` credited on CAUGHT, stumpings on STUMPED, run-outs on
RUN_OUT.

## Web UI (dark theme, existing tokens)

1. **Sign-in flow** (`#/signin`): mobile input (10 digits, keypad-friendly)
   → request OTP → code screen (dev: code shown on screen from `devOtp`)
   → verified → JWT stored in `localStorage('token')`. Separate
   "New player? register" path collects name before verify
   (`POST /auth/register`).
2. **Profile screen** (`#/profile`): header (name, location, career strip
   Matches/Runs/Wickets), editable chips: role (4-way selector — batsman,
   bowler, wicketkeeper, all-rounder), batting hand (RHB/LHB), bowling
   style, location; stats tabs **batting / bowling / fielding** — all free,
   no upsell. Signed-out visitors see a sign-in prompt instead.
3. **Setup flow lineup step**: two add modes as tabs — "By name" (text +
   quick add, current behavior kept) and "By number" (number input,
   typeahead results with name + role, create-new fallback). Selected
   players show name, role icon, and ✓ if their number is registered.
4. **Scorecard/scoring screens**: where player ids are displayed today,
   resolve names via `playerRefs` so scorecards read like CricHeroes'.

Header gains a Profile/Sign-in link when signed in/out.

## Error handling

- Server: `ApiError(statusCode, code, message)` pattern already in
  `store.ts` — all new errors use it; error handler unchanged.
- Web: `ApiRequestError.code` surfaced in the existing toast pattern.
- Engine untouched this phase (player ids are opaque strings today).

## Testing (TDD, commands as in repo)

- **server** (`node ..\node_modules\vitest\vitest.mjs run`): db create/seed;
  OTP request/verify (wrong, expired, 3-strike), register, me/patch auth
  guards; directory search (mobile prefix, name prefix, empty/short query);
  create-player 409; stats fold (batting, bowling, fielding, corrections);
  restart survival (new MatchStore over same DB sees old match).
- **web** (`node ..\node_modules\vitest\vitest.mjs run`): lineup add-by-name
  vs add-by-number reducers, typeahead query building, sign-in state machine
  (mobile→otp→verify, register branch), profile form validation (role enums),
  name resolution from playerRefs, fielder-picker defaults for CAUGHT/STUMPED/RUN_OUT.
- **e2e (Playwright, real stack)**: register → sign in → edit profile →
  start match adding one player by number from the directory and one by
  name → score a ball → sign-out path; verify scorecard shows the directory
  player's real name.
- Rebuild core dist after any core change (not expected this phase);
  server tests + typecheck after each server task; web tests + typecheck
  after each web task.

## Out of scope (this phase)

Photos, teams-as-entities/captains/invites, awards/badges, tournaments,
friends/connections, PIN-as-password, real SMS sending, Postgres, native
apps. Each layers on later without reworking this design.

## Success criteria

1. Register a player with mobile + OTP (dev code), edit role/style/location,
   sign out and back in — session persists.
2. In match setup, add one player by name and one by mobile-number lookup;
   both appear in the lineup; scorecard shows the directory player's name.
3. After a completed match, the scorer's profile shows updated career stats.
4. Server restart → previous matches and players still present.
5. All suites green: core 51+, server + auth/db/stats tests, web tests;
   typecheck clean in all three packages.
