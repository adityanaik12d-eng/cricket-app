# Cricket App — Build Progress

Goal: ship a working app (core engine → API → web UI). Dark, phone+tablet friendly. No check-ins, keep moving.

## Phase 1: Core engine (packages/core)
- [x] Types, errors, overs, config, state, validate (skeletal), apply (basic), projections (live/scorecard/result) — 25/25 tests green
- [ ] apply: full ball scoring (runs, extras, batter/bowler lines, strike rotation)
- [ ] apply: wickets + next batter + bowler credit
- [ ] apply: over completion, bowler validations (quota, consecutive, is-batter)
- [ ] apply: innings close/transition, results (wickets/runs/tie), declare/penalty/end-match
- [ ] apply: corrections (superseded events) + idempotency
- [ ] commentary projection (nice-to-have)

## Phase 2: Server (server/) — Fastify
- [ ] In-memory match store: create match, submit events, read state
- [ ] REST: POST /matches, GET /matches/:id, POST /matches/:id/events, GET live/scorecard, SSE stream

## Phase 3: Web (web/) — React + Vite PWA, dark, responsive
- [ ] Scaffold + dark theme tokens
- [ ] Match setup screen
- [ ] Scoring pad (ball input) 
- [ ] Live scoreboard + scorecard view

## Notes
- Test cmd: `cd packages/core; node ..\..\node_modules\vitest\vitest.mjs run`
- Typecheck: `node ..\..\node_modules\typescript\bin\tsc --noEmit`
- PowerShell: no `&&`, no tail/grep/wc
- Git: `git -C C:\Users\IT\cricket-app ...` (cwd resets)
