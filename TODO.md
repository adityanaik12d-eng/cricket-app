# Cricket App - Build Progress

Goal: ship a working app (core engine + API + web UI). Dark, phone+tablet friendly. No check-ins, keep moving.

## Phase 1: Core engine (packages/core) - COMPLETE (72/72 tests)
- [x] Types, errors, overs, config, state, validate, apply, projections (live/scorecard/result)
- [x] Full ball scoring: runs, extras (wide/no-ball/bye/leg-bye), batter/bowler lines, strike rotation
- [x] Wickets, next batter, bowler credit (not for run out)
- [x] Over completion, bowler validations (quota, consecutive, is-batter, striker match)
- [x] Innings close/transition, results (wickets/runs/tie), declare, penalty, end-match
- [x] Corrections (superseded events replayed with replacement)
- [x] EngineError carries validation code for API error responses
- [x] playerRefs (id -> {name, mobile, verified}) and optional fielderId on wickets
- [x] Commentary projection (nice-to-have) - see Phase 4.2

## Phase 2: Server (server/) - COMPLETE (52/52 tests)
- [x] MatchStore: create match, append events (full-log replay), read state
- [x] Persistence via SQLite (node:sqlite): matches and events survive a restart
- [x] POST /matches, GET /matches/:id, POST/GET /matches/:id/events
- [x] GET /matches/:id/live, /scorecard, /result (via GET /matches/:id)
- [x] SSE stream GET /matches/:id/stream (initial + per-event live updates)
- [x] Errors: 400 {error, code} (ApiError/EngineError), 404 unknown match
- [x] Runs standalone: `node --experimental-strip-types src/index.ts` (imports use .ts extensions)

## Phase 3: Web (web/) - COMPLETE (36/36 tests, React + Vite PWA, dark, responsive)
- [x] Scaffold + dark theme tokens
- [x] Match setup screen
- [x] Scoring pad (ball input)
- [x] Live scoreboard + scorecard view
- [x] SSE live updates (Vite proxy to :3000)

## Phase 4: Accounts, player directory & career stats - COMPLETE (e2e verified)
- [x] Player directory + search + career stats (mobile number = unique identity)
- [x] Roles: BATSMAN / BOWLER / KEEPER / ALL_ROUNDER
- [x] OTP sign-in (6-digit, 5-min TTL, 3 attempts) + JWT (HS256, 30-day expiry)
- [x] Profile: role, batting/bowling style, location, career strip + stats grid (all stats free)
- [x] Lineup entry by name and by number; by-name (unverified) entries never require an account
- [x] Player display names + fielded-by picker in scoring; names (not ids) in the scorecard
- [x] Scoring works without signing in

## Phase 4.1: Deferred-minor hardening - COMPLETE
- [x] Core: `effectiveEvents` regression tests + last-correction-wins documented
- [x] Server: explicit `PRAGMA foreign_keys = ON`; `MatchStore.append` persists before mutating in-memory state
- [x] Auth: reject token at exact expiry, empty `OTP_PROVIDER` falls back to dev, reject non-string profile fields
- [x] Career stats: overs/economy honor each match's `ballsPerOver` (and stay mutually consistent)
- [x] Route-level `/players` tests; profile "All-rounder" label; lineup local-id reset on new setup

## Phase 4.2: Commentary projection - COMPLETE
- [x] Core `projectCommentary(config, events)` projection: ball-by-ball lines with over headers, toss/innings-break/end framing; honors corrections via `effectiveEvents`; names from `playerRefs`
- [x] Server `GET /matches/:id/commentary` returns `{ commentary }`
- [x] Web Commentary card in the scorecard view (newest-first), fetched on the scorecard tab

Dev OTP: in development the code is logged by the server as `OTP <code> for <mobile>`; real SMS delivery is deferred.

## Notes
- Core test cmd: `cd packages/core; node ..\..\node_modules\vitest\vitest.mjs run`
- Server test cmd: `cd server; node ..\node_modules\vitest\vitest.mjs run`
- Web test cmd: `cd web; node ..\node_modules\vitest\vitest.mjs run`
- Typecheck: `node ..\..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit`
- PowerShell: no `&&`, no tail/grep/wc
- Git: `git -C C:\Users\IT\cricket-app ...` (cwd resets)
- Core changes require rebuild: `tsc -p packages/core/tsconfig.json` (server imports dist/)
