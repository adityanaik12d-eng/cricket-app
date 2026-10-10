# Cricket App - Build Progress

Goal: ship a working app (core engine + API + web UI). Dark, phone+tablet friendly. No check-ins, keep moving.

## Phase 1: Core engine (packages/core) - COMPLETE (51/51 tests)
- [x] Types, errors, overs, config, state, validate, apply, projections (live/scorecard/result)
- [x] Full ball scoring: runs, extras (wide/no-ball/bye/leg-bye), batter/bowler lines, strike rotation
- [x] Wickets, next batter, bowler credit (not for run out)
- [x] Over completion, bowler validations (quota, consecutive, is-batter, striker match)
- [x] Innings close/transition, results (wickets/runs/tie), declare, penalty, end-match
- [x] Corrections (superseded events replayed with replacement)
- [x] EngineError carries validation code for API error responses
- [ ] commentary projection (nice-to-have)

## Phase 2: Server (server/) - COMPLETE (11/11 tests)
- [x] In-memory MatchStore: create match, append events (full-log replay), read state
- [x] POST /matches, GET /matches/:id, POST/GET /matches/:id/events
- [x] GET /matches/:id/live, /scorecard, /result (via GET /matches/:id)
- [x] SSE stream GET /matches/:id/stream (initial + per-event live updates)
- [x] Errors: 400 {error, code} (ApiError/EngineError), 404 unknown match
- [x] Runs standalone: `node --experimental-strip-types src/index.ts` (imports use .ts extensions)

## Phase 3: Web (web/) - NEXT, React + Vite PWA, dark, responsive
- [x] Scaffold + dark theme tokens
- [x] Match setup screen
- [x] Scoring pad (ball input)
- [x] Live scoreboard + scorecard view
- [x] SSE live updates (Vite proxy to :3000)

## Notes
- Core test cmd: `cd packages/core; node ..\..\node_modules\vitest\vitest.mjs run`
- Server test cmd: `cd server; node ..\node_modules\vitest\vitest.mjs run`
- Typecheck: `node ..\..\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit`
- PowerShell: no `&&`, no tail/grep/wc
- Git: `git -C C:\Users\IT\cricket-app ...` (cwd resets)
- Core changes require rebuild: `tsc -p packages/core/tsconfig.json` (server imports dist/)
