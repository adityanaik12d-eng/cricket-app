# Cricket App — Build Progress

Goal: ship a working app (core engine → API → web UI). Dark, phone+tablet friendly. No check-ins, keep moving.

## Phase 1: Core engine (packages/core) — COMPLETE (49/49 tests)
- [x] Types, errors, overs, config, state, validate, apply, projections (live/scorecard/result)
- [x] Full ball scoring: runs, extras (wide/no-ball/bye/leg-bye), batter/bowler lines, strike rotation
- [x] Wickets, next batter, bowler credit (not for run out)
- [x] Over completion, bowler validations (quota, consecutive, is-batter, striker match)
- [x] Innings close/transition, results (wickets/runs/tie), declare, penalty, end-match
- [x] Corrections (superseded events replayed with replacement)
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
