# Home Board and Match Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the scorer a landing page that shows every match being played right now plus the matches created on this device, and give each match a broadcast-style report tab (result line, both innings summarised, commentary) while keeping the existing full scorecard and the existing share links working.

**Architecture:** The browser stays the only "server". A Home board reads the ~50 most recently updated rows from the single `public.matches` table and replays each one with the same pure engine the match screen uses, so a card can never disagree with the match. "Your matches" is a list of ids in `localStorage` (there are no accounts). Routing stays hash-based; `#/` becomes the board, the setup/toss flow moves to `#/new`, and `#/match/<id>` keeps working exactly as today so every link already shared still opens. The Report tab is a new projection over data the match screen already has.

**Tech Stack:** React 18 + Vite + TypeScript (strict), Vitest (node environment, no jsdom), `renderToStaticMarkup` from `react-dom/server` for component tests, `@supabase/supabase-js` (Postgres + Realtime), pure engine package `@cricket-app/core`.

**Spec:** `docs/superpowers/specs/2026-10-15-home-and-match-report-design.md` (committed `5373dc4`, approved by the user).

**Repo root:** `C:\Users\IT\cricket-app` — work on `master`, no worktree. Shell is PowerShell (no `&&`; join commands with `;`).

---

## Global Constraints

- **Language/style:** TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). No semicolons, single quotes, 2-space indent. Match the surrounding code exactly.
- **Imports:** web files import extensionless (`'./match'`); files inside `packages/core` import with `.js`.
- **Do not modify `packages/core`.** Everything in this plan is web-layer.
- **Do not change the database.** The `public.matches` table stays `(id uuid pk, config jsonb, events jsonb, created_at, updated_at)`. No new columns, no new tables, no RLS changes.
- **Share links are frozen API.** `#/match/<id>` must keep opening the Scoring tab with no redirect.
- **Component tests use `renderToStaticMarkup`** — no jsdom, no React Testing Library, no `@testing-library/*`. Effects do not run under `renderToStaticMarkup`, so data-fetching logic must be separated from the markup logic (this plan puts presentational components in the same file as the container and tests only the presentational ones).
- **Touch targets ≥48px**, dark theme, reuse existing CSS classes (`.card`, `.btn`, `.topbar`, `.tabs`, `.tab`, `.muted`, `.pill`) and add new ones only where Task 9 says.
- **Run commands** (PowerShell, from the repo root unless noted):
  - all web tests: `cd web; node ..\node_modules\vitest\vitest.mjs run`
  - one web test file: `cd web; node ..\node_modules\vitest\vitest.mjs run src/match.test.ts`
  - web typecheck: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
  - web build: `npm run build -w @cricket-app/web`
  - whole suite (core + web + server): `npm test`
- **Every task ends with a commit** on `master`. Commit messages use the repo's style (short imperative subject).

## Review Focus

These are the five input classes the spec depends on but that a naive implementation would miss. Each one is exercised by a test in the task named in brackets — the tests are not optional.

1. **A row that no longer replays must not blank the board.** Any row in `matches` (including the stray probe row `83b863c3-320d-4e37-957b-229dc40fc2e4`, whose `config` is `{ping:'probe'}`) can fail `applyEvents`. The board must skip that row and render the rest. [Task 1 — `summarizeRows` test]
2. **A match with no events yet.** A freshly created match has `events: []` and status `CREATED`; its card must read "Yet to start" and show no score, not `0-0`. [Task 1 — `summarize` test]
3. **`localStorage` unavailable or poisoned.** Private browsing and full quota both make `localStorage` throw. "Your matches" and the remember-on-create write must degrade to an empty list without breaking Home. [Task 2 — `myMatches` tests]
4. **Corrections in the log.** The engine's `CORRECTION` event substitutes an earlier delivery; the board must replay through the same `applyEvents`, so a corrected ball shows the corrected score. [Task 1 — `summarize` correction test]
5. **Supabase outage / offline.** Home must show the error and keep the Refresh button usable rather than rendering an empty page. [Task 4 — `HomeBoard` error-state test]

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `web/src/match.ts` | modify | Add `summarize` (one row → card view-model) and `summarizeRows` (many rows, skipping bad ones). Pure, no I/O. |
| `web/src/match.test.ts` | modify | Tests for `summarize`/`summarizeRows`. |
| `web/src/scoring.ts` | modify | Add `resultText`, `topScorer`, `topBowler`, `requirementText` — the report's headline helpers. |
| `web/src/scoring.test.ts` | modify | Tests for the four helpers. |
| `web/src/myMatches.ts` | create | `localStorage` list of match ids this device created: `myMatchIds`, `rememberMatch`. Degrades silently. |
| `web/src/myMatches.test.ts` | create | Tests using a fake store (no `localStorage` in node). |
| `web/src/api.ts` | modify | Add `listMatches({ limit, ids })` — the only new I/O. |
| `web/src/routes.ts` | create | `Route` type + `parseHash`, extracted from `App.tsx` so routing is testable. |
| `web/src/routes.test.ts` | create | Tests for every route form, including that `#/match/<id>` still means Scoring. |
| `web/src/HomeScreen.tsx` | create | `MatchCard` + `HomeBoard` (pure, tested) and `HomeScreen` (container: fetch + Realtime + Refresh). |
| `web/src/HomeScreen.test.tsx` | create | `renderToStaticMarkup` tests for `MatchCard`/`HomeBoard`. |
| `web/src/MatchReport.tsx` | create | The broadcast report: result line, innings summaries, commentary. Pure component, no fetching. |
| `web/src/MatchReport.test.tsx` | create | `renderToStaticMarkup` tests. |
| `web/src/App.tsx` | modify | Use `routes.ts`; render Home at `#/`, setup at `#/new`; pass the tab to `ScoringScreen`; remember new matches. |
| `web/src/ScoringScreen.tsx` | modify | Accept `initialTab`; add the Report tab; fetch commentary for Report as well as Scorecard. |
| `web/src/index.css` | modify | Board + report styles. |

---

## Task 1: `summarize` and `summarizeRows`

The board needs one line per match: teams, score, status, result. That is a pure function over `(config, events)` — the same `applyEvents`/`projectScorecard` the match screen uses.

**Files:**
- Modify: `web/src/match.ts`
- Test: `web/src/match.test.ts`

**Interfaces:**
- Consumes: `applyEvents`, `projectScorecard`, `projectResult` from `@cricket-app/core` (all already imported by `match.ts`), and `formatWin` from `./scoring` (Task 5 adds `resultText`, and `summarize` uses that instead — see step 3, which is why Task 5 must land first **or** the local `resultText` shim in step 3 is used and replaced in Task 5).

> **Ordering note:** `summarize` needs `resultText`. Do **Task 5's `resultText`** first if you prefer strict ordering; otherwise implement `summarize` with the tiny inline `resultText` shown here and Task 5 replaces it with the exported, tested version. Either way the final code must import `resultText` from `./scoring`.

- Produces:
  ```ts
  export interface MatchRowInput {
    id: string
    config: unknown
    events: unknown
  }

  export type SummaryStatus = 'UPCOMING' | 'LIVE' | 'BREAK' | 'DONE'

  export interface MatchSummary {
    matchId: string
    teamAId: string
    teamBId: string
    label: string
    score: string | null
    status: SummaryStatus
    statusText: string
    resultText: string | null
  }

  export function summarize(matchId: string, config: MatchConfig, events: MatchEvent[]): MatchSummary
  export function summarizeRows(rows: MatchRowInput[]): MatchSummary[]
  ```

- [ ] **Step 1: Write the failing tests**

Append to `web/src/match.test.ts`. Merge the imports at the top of the file rather than adding a second import block.

```ts
import { applyEvents, projectScorecard } from '@cricket-app/core'
import type { MatchEvent } from '@cricket-app/core'
import { buildConfig, buildEvent, summarize, summarizeRows } from './match'

const CONFIG_INPUT = {
  teamAId: 'India',
  teamBId: 'Australia',
  lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  oversPerInnings: 2,
}

const toss = (): MatchEvent =>
  buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' }, 'e1', 't')

/**
 * A legal delivery. `over`/`ball` are labels only — the engine counts legal
 * balls itself — so copy the numbering from the BALL fixtures already in this
 * file if these values disagree with the engine's expectations.
 */
const ball = (seq: number, runs: number): MatchEvent =>
  buildEvent(
    'm1',
    seq,
    {
      type: 'BALL',
      over: 0,
      ball: seq - 1,
      runs,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    },
    `e${seq}`,
    't',
  )

const endMatch = (seq: number, outcome: unknown): MatchEvent =>
  buildEvent('m1', seq, { type: 'END_MATCH', outcome }, `e${seq}`, 't')

describe('summarize', () => {
  it('shows a created match as yet to start with no score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    expect(summarize('m1', config, [])).toEqual({
      matchId: 'm1',
      teamAId: 'India',
      teamBId: 'Australia',
      label: 'India vs Australia',
      score: null,
      status: 'UPCOMING',
      statusText: 'Yet to start',
      resultText: null,
    })
  })

  it('shows a live match with the current score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), ball(2, 4), ball(3, 0)])
    expect(summary.status).toBe('LIVE')
    expect(summary.statusText).toBe('LIVE')
    expect(summary.score).toBe('4-0 (0.2 ov)')
    expect(summary.resultText).toBeNull()
  })

  it('replays a correction before summarising (review focus 4)', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const correction = buildEvent(
      'm1',
      3,
      {
        type: 'CORRECTION',
        supersedes: 'e2',
        replacement: {
          kind: 'BALL',
          ball: {
            over: 0,
            ball: 0,
            runs: 6,
            extras: 'NONE',
            wicket: false,
            dismissal: null,
            dismissedPlayerId: null,
            batterId: 'a1',
            nonStrikerId: 'a2',
            bowlerId: 'b1',
            fieldingCaptainId: 'b1',
          },
        },
        reason: 'miscounted',
      },
      'e3',
      't',
    )
    // Ball e2 was 4; the correction replaces it with 6.
    const summary = summarize('m1', config, [toss(), ball(2, 4), correction])
    expect(summary.score).toBe('6-0 (0.1 ov)')
  })

  it('reports a tied match as a result', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), ball(2, 4), endMatch(3, { kind: 'TIE' })])
    expect(summary.status).toBe('DONE')
    expect(summary.statusText).toBe('Result')
    expect(summary.resultText).toBe('Match tied')
  })

  it('reports an abandoned match with its reason', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const summary = summarize('m1', config, [toss(), endMatch(2, { kind: 'ABANDONED', reason: 'Rain' })])
    expect(summary.status).toBe('DONE')
    expect(summary.resultText).toBe('Match abandoned: Rain')
  })

  it('uses the most recent innings that has any activity for the score', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const state = applyEvents(config, [toss(), ball(2, 4)])
    const card = projectScorecard(state)
    const summary = summarize('m1', config, [toss(), ball(2, 4)])
    const shown = card.innings[card.innings.length - 1]
    expect(shown).toBeDefined()
    expect(summary.score).toBe(`${shown?.runs}-${shown?.wickets} (${shown?.oversText} ov)`)
  })
})

describe('summarizeRows', () => {
  it('skips rows whose config no longer replays (review focus 1)', () => {
    const config = buildConfig(CONFIG_INPUT, 'm1')
    const rows = [
      { id: 'm1', config, events: [toss(), ball(2, 4)] },
      { id: 'bad', config: { ping: 'probe' }, events: [{ type: 'BALL' }] },
      { id: 'missing', config, events: null },
    ]
    const summaries = summarizeRows(rows)
    expect(summaries.map((s) => s.matchId)).toEqual(['m1', 'missing'])
  })

  it('returns an empty list for no rows', () => {
    expect(summarizeRows([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/match.test.ts`
Expected: FAIL — `summarize is not a function` / `summarizeRows is not a function`.

- [ ] **Step 3: Implement**

In `web/src/match.ts`, add the import (keep the existing import blocks; add `resultText` to the `./scoring` import once Task 5 has exported it — until then define a local `resultText` function with the same body and delete it in Task 5):

```ts
import { resultText } from './scoring'
```

Append to `web/src/match.ts`:

```ts
export type SummaryStatus = 'UPCOMING' | 'LIVE' | 'BREAK' | 'DONE'

/** One board card: everything Home needs, and nothing it has to compute itself. */
export interface MatchSummary {
  matchId: string
  teamAId: string
  teamBId: string
  label: string
  score: string | null
  status: SummaryStatus
  statusText: string
  resultText: string | null
}

export interface MatchRowInput {
  id: string
  config: unknown
  events: unknown
}

/** A live match and an innings break both look "in play" on the board. */
function summaryStatus(status: MatchState['status']): { status: SummaryStatus; text: string } {
  switch (status) {
    case 'IN_PROGRESS':
      return { status: 'LIVE', text: 'LIVE' }
    case 'INNINGS_BREAK':
      return { status: 'BREAK', text: 'Innings break' }
    case 'COMPLETED':
    case 'TIED':
    case 'ABANDONED':
      return { status: 'DONE', text: 'Result' }
    default:
      return { status: 'UPCOMING', text: 'Yet to start' }
  }
}

/**
 * Replays one stored match into a board card. Uses the same engine as the match
 * screen, so the board can never disagree with the scorecard. Throws if the
 * stored config/events are no longer replayable — `summarizeRows` is the caller
 * that tolerates that.
 */
export function summarize(matchId: string, config: MatchConfig, events: MatchEvent[]): MatchSummary {
  const state = applyEvents(config, events)
  const scorecard = projectScorecard(state)
  const played = scorecard.innings.filter((i) => i.legalBalls > 0 || i.runs > 0 || i.closed)
  const shown = played.length > 0 ? played[played.length - 1] : undefined
  const label = summaryStatus(state.status)
  return {
    matchId,
    teamAId: config.teamAId,
    teamBId: config.teamBId,
    label: `${config.teamAId} vs ${config.teamBId}`,
    score: shown ? `${shown.runs}-${shown.wickets} (${shown.oversText} ov)` : null,
    status: label.status,
    statusText: label.text,
    resultText: resultText(projectResult(state)),
  }
}

/**
 * Summarises many rows, silently dropping any that no longer replay (an old
 * schema, a hand-edited row) so one bad match cannot blank the board.
 */
export function summarizeRows(rows: MatchRowInput[]): MatchSummary[] {
  const out: MatchSummary[] = []
  for (const row of rows) {
    try {
      const events = Array.isArray(row.events) ? (row.events as MatchEvent[]) : []
      out.push(summarize(row.id, row.config as MatchConfig, events))
    } catch {
      // Unreplayable rows are skipped, not surfaced.
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/match.test.ts`
Expected: PASS. If the score assertions fail on overs only, fix the `over`/`ball` labels in the test's `ball()` helper to match the BALL fixtures already in `match.test.ts` — the engine derives overs from legal balls, so the labels are cosmetic.

- [ ] **Step 5: Typecheck**

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add web/src/match.ts web/src/match.test.ts; git commit -m "Add summarize helper for home board cards"
```

---

## Task 2: `myMatches` (this device's matches)

**Files:**
- Create: `web/src/myMatches.ts`
- Test: `web/src/myMatches.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MatchStore {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
  export function myMatchIds(store?: MatchStore): string[]
  export function rememberMatch(id: string, store?: MatchStore): void
  ```
  The default argument is `localStorage`; tests always pass a fake because node has no `localStorage`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/myMatches.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { myMatchIds, rememberMatch } from './myMatches'
import type { MatchStore } from './myMatches'

function fakeStore(initial: Record<string, string> = {}, opts: { readThrows?: boolean; writeThrows?: boolean } = {}) {
  const data = new Map(Object.entries(initial))
  const store: MatchStore = {
    getItem: (key) => {
      if (opts.readThrows) throw new Error('blocked')
      return data.get(key) ?? null
    },
    setItem: (key, value) => {
      if (opts.writeThrows) throw new Error('quota')
      data.set(key, value)
    },
  }
  return { store, data }
}

describe('myMatches', () => {
  it('starts empty', () => {
    expect(myMatchIds(fakeStore().store)).toEqual([])
  })

  it('remembers a match', () => {
    const { store } = fakeStore()
    rememberMatch('m1', store)
    expect(myMatchIds(store)).toEqual(['m1'])
  })

  it('keeps the newest match first and does not duplicate', () => {
    const { store } = fakeStore()
    rememberMatch('m1', store)
    rememberMatch('m2', store)
    rememberMatch('m1', store)
    expect(myMatchIds(store)).toEqual(['m1', 'm2'])
  })

  it('caps the list at 50 ids', () => {
    const { store } = fakeStore()
    for (let i = 0; i < 60; i++) rememberMatch(`m${i}`, store)
    const ids = myMatchIds(store)
    expect(ids).toHaveLength(50)
    expect(ids[0]).toBe('m59')
  })

  it('ignores malformed storage contents', () => {
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': 'not json' }).store)).toEqual([])
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': '{"a":1}' }).store)).toEqual([])
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': '[1,"m1",null]' }).store)).toEqual(['m1'])
  })

  it('survives a store that throws (review focus 3)', () => {
    expect(myMatchIds(fakeStore({}, { readThrows: true }).store)).toEqual([])
    expect(() => rememberMatch('m1', fakeStore({}, { writeThrows: true }).store)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/myMatches.test.ts`
Expected: FAIL — cannot resolve `./myMatches`.

- [ ] **Step 3: Implement**

Create `web/src/myMatches.ts`:

```ts
/**
 * The matches created on this device. There are no accounts, so "Your matches"
 * is just a list of ids in localStorage — it never leaves the browser and it is
 * allowed to be lost (private mode, cleared storage).
 */
const KEY = 'cricket.myMatches'
const MAX = 50

export interface MatchStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function parse(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

/** Newest first. Never throws — a blocked or poisoned store reads as empty. */
export function myMatchIds(store: MatchStore = localStorage): string[] {
  try {
    return parse(store.getItem(KEY)).slice(0, MAX)
  } catch {
    return []
  }
}

/** Called once when a match is created. Never throws — losing this list is survivable. */
export function rememberMatch(id: string, store: MatchStore = localStorage): void {
  try {
    const next = [id, ...myMatchIds(store).filter((existing) => existing !== id)].slice(0, MAX)
    store.setItem(KEY, JSON.stringify(next))
  } catch {
    // No storage (private mode, quota): the match still exists, we just cannot list it.
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/myMatches.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add web/src/myMatches.ts web/src/myMatches.test.ts; git commit -m "Add myMatches device-local match list"
```

---

## Task 3: `api.listMatches`

The one piece of new I/O. It selects rows and hands them to `summarizeRows`, so all tolerance for bad rows lives in one tested place.

**Files:**
- Modify: `web/src/api.ts`

**Interfaces:**
- Consumes: `summarizeRows` from `./match` (Task 1).
- Produces: `api.listMatches(opts?: { limit?: number; ids?: string[] }): Promise<MatchSummary[]>`

- [ ] **Step 1: Add the method**

In `web/src/api.ts`, extend the existing `./match` import to include `summarizeRows` and `MatchSummary`:

```ts
import { MatchError, appendEvent, buildConfig, computeBundle, computeCommentary, summarizeRows, withoutLastEvent } from './match'
import type { MatchBundle, MatchSummary } from './match'
```

Add to the returned `api` object (after `getCommentary`, before `undoLast`):

```ts
  /**
   * Board data. With `ids`, fetches exactly those matches (finished ones
   * included); otherwise the most recently updated matches across the board.
   * Rows that no longer replay are dropped rather than failing the request.
   */
  async listMatches(opts: { limit?: number; ids?: string[] } = {}): Promise<MatchSummary[]> {
    const limit = opts.limit ?? 50
    const query = getSupabase().from('matches').select('id, config, events, updated_at')
    const shaped = opts.ids
      ? query.in('id', opts.ids)
      : query.order('updated_at', { ascending: false }).limit(limit)
    const { data, error } = await shaped
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    return summarizeRows((data ?? []) as { id: string; config: unknown; events: unknown }[])
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify against the live project**

There is no unit test here — it is thin glue over the Supabase client, and the row→card logic is already covered by Task 1. Verify against the real project instead:

```powershell
cd C:\Users\IT\cricket-app; node --experimental-strip-types scripts/supabase-e2e.mts
```
Expected: the existing 13 checks still pass (this proves the new import did not break the module graph).

Then, after Task 4 renders Home, confirm on the deployed site that "Live now" is populated. If `listMatches()` returns `[]` while rows exist, check the Supabase `select` policy on `matches` (it must allow anon `SELECT`) before touching the code.

- [ ] **Step 4: Commit**

```powershell
git add web/src/api.ts; git commit -m "Add api.listMatches for the home board"
```

---

## Task 4: `HomeScreen`

The container fetches and subscribes; the presentational parts are exported separately so they can be tested with `renderToStaticMarkup`.

**Files:**
- Create: `web/src/HomeScreen.tsx`
- Test: `web/src/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `api.listMatches` (Task 3), `myMatchIds` (Task 2), `getSupabase` from `./supabase`, `MatchSummary` (Task 1).
- Produces:
  ```ts
  export function MatchCard(props: { summary: MatchSummary; onOpen: (matchId: string) => void }): JSX.Element
  export interface HomeBoardProps {
    liveNow: MatchSummary[]
    mine: MatchSummary[]
    error: string | null
    loading: boolean
    onNew: () => void
    onRefresh: () => void
    onOpen: (matchId: string) => void
  }
  export function HomeBoard(props: HomeBoardProps): JSX.Element
  export function HomeScreen(props: { onNewMatch: () => void; onOpenMatch: (matchId: string) => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `web/src/HomeScreen.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeBoard, MatchCard } from './HomeScreen'
import type { MatchSummary } from './match'

const live: MatchSummary = {
  matchId: 'm1',
  teamAId: 'India',
  teamBId: 'Australia',
  label: 'India vs Australia',
  score: '148-3 (16.2 ov)',
  status: 'LIVE',
  statusText: 'LIVE',
  resultText: null,
}

const done: MatchSummary = {
  ...live,
  matchId: 'm2',
  label: 'Chennai vs Mumbai',
  score: '171-6 (20 ov)',
  status: 'DONE',
  statusText: 'Result',
  resultText: 'Chennai won by 12 runs',
}

const noop = (): void => {}

describe('MatchCard', () => {
  it('shows teams, score, status pill and result line', () => {
    const html = renderToStaticMarkup(<MatchCard summary={live} onOpen={noop} />)
    expect(html).toContain('India vs Australia')
    expect(html).toContain('148-3 (16.2 ov)')
    expect(html).toContain('LIVE')
  })

  it('shows the result line for a finished match', () => {
    const html = renderToStaticMarkup(<MatchCard summary={done} onOpen={noop} />)
    expect(html).toContain('Chennai won by 12 runs')
    expect(html).toContain('Result')
  })

  it('omits the score for a match that has not started (review focus 2)', () => {
    const upcoming: MatchSummary = { ...live, score: null, status: 'UPCOMING', statusText: 'Yet to start' }
    const html = renderToStaticMarkup(<MatchCard summary={upcoming} onOpen={noop} />)
    expect(html).toContain('Yet to start')
    expect(html).not.toContain('(0.0 ov)')
  })
})

describe('HomeBoard', () => {
  it('renders both sections with their cards', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[live]} mine={[done]} error={null} loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Live now')
    expect(html).toContain('Your matches')
    expect(html).toContain('India vs Australia')
    expect(html).toContain('Chennai vs Mumbai')
  })

  it('shows empty states instead of blank sections', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[]} mine={[]} error={null} loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Nothing being played right now.')
    expect(html).toContain('No matches on this device yet.')
  })

  it('shows the error and keeps Refresh usable (review focus 5)', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[]} mine={[]} error="Network unreachable" loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Network unreachable')
    expect(html).toContain('Refresh')
    expect(html).not.toContain('disabled')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/HomeScreen.test.tsx`
Expected: FAIL — cannot resolve `./HomeScreen`.

- [ ] **Step 3: Implement**

Create `web/src/HomeScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { myMatchIds } from './myMatches'
import { getSupabase } from './supabase'
import type { MatchSummary } from './match'

interface MatchCardProps {
  summary: MatchSummary
  onOpen: (matchId: string) => void
}

export function MatchCard({ summary, onOpen }: MatchCardProps) {
  return (
    <button className="card match-card" onClick={() => onOpen(summary.matchId)}>
      <span className="match-teams">{summary.label}</span>
      <span className={`pill ${summary.status.toLowerCase()}`}>{summary.statusText}</span>
      {summary.score && <span className="match-score">{summary.score}</span>}
      {summary.resultText && <span className="muted match-result">{summary.resultText}</span>}
    </button>
  )
}

export interface HomeBoardProps {
  liveNow: MatchSummary[]
  mine: MatchSummary[]
  error: string | null
  loading: boolean
  onNew: () => void
  onRefresh: () => void
  onOpen: (matchId: string) => void
}

function Section(props: { title: string; empty: string; matches: MatchSummary[]; onOpen: (matchId: string) => void }) {
  return (
    <section className="board-section">
      <h2>{props.title}</h2>
      {props.matches.length === 0 ? (
        <p className="muted">{props.empty}</p>
      ) : (
        <div className="board-list">
          {props.matches.map((summary) => (
            <MatchCard key={summary.matchId} summary={summary} onOpen={props.onOpen} />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomeBoard({ liveNow, mine, error, loading, onNew, onRefresh, onOpen }: HomeBoardProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <h1>Cricket Scorer</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn accent" onClick={onNew}>
            + New match
          </button>
        </div>
      </header>
      <main className="board">
        {error && <div className="banner warn">{error}</div>}
        {loading && liveNow.length === 0 && mine.length === 0 && <p className="muted">Loading matches…</p>}
        <Section title="Live now" empty="Nothing being played right now." matches={liveNow} onOpen={onOpen} />
        <Section title="Your matches" empty="No matches on this device yet." matches={mine} onOpen={onOpen} />
      </main>
    </div>
  )
}

export function HomeScreen({ onNewMatch, onOpenMatch }: { onNewMatch: () => void; onOpenMatch: (matchId: string) => void }) {
  const [liveNow, setLiveNow] = useState<MatchSummary[]>([])
  const [mine, setMine] = useState<MatchSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      try {
        const [board, own] = await Promise.all([
          api.listMatches(),
          api.listMatches({ ids: myMatchIds() }),
        ])
        if (!alive) return
        setLiveNow(board.filter((m) => m.status === 'LIVE' || m.status === 'BREAK'))
        setMine(own)
        setError(null)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load matches')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [reload])

  // Any change to any match row re-reads the board.
  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel('home-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  return (
    <HomeBoard
      liveNow={liveNow}
      mine={mine}
      error={error}
      loading={loading}
      onNew={onNewMatch}
      onRefresh={refresh}
      onOpen={onOpenMatch}
    />
  )
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/HomeScreen.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0. (React 18 + the repo's tsconfig allow the JSX return type without importing `JSX`; if the typechecker complains about the bare `JSX.Element` annotations in this plan's interface snippets, drop the explicit return types — the components are inferred.)

- [ ] **Step 6: Commit**

```powershell
git add web/src/HomeScreen.tsx web/src/HomeScreen.test.tsx; git commit -m "Add home board with live and your matches"
```

---

## Task 5: Report helpers in `scoring.ts`

**Files:**
- Modify: `web/src/scoring.ts`
- Test: `web/src/scoring.test.ts`

**Interfaces:**
- Consumes: existing `formatWin` in the same file.
- Produces:
  ```ts
  export function resultText(result: MatchResult | null): string | null
  export function topScorer(inn: InningsCard): BattingCardLine | null
  export function topBowler(inn: InningsCard): BowlingCardLine | null
  export function requirementText(live: LiveScore): string | null
  ```

- [ ] **Step 1: Write the failing tests**

Append to `web/src/scoring.test.ts` (merge imports):

```ts
import { requirementText, resultText, topBowler, topScorer } from './scoring'
import type { BattingCardLine, BowlingCardLine, InningsCard, LiveScore } from '@cricket-app/core'

function innings(over: Partial<InningsCard> = {}): InningsCard {
  return {
    index: 0,
    battingTeamId: 'India',
    bowlingTeamId: 'Australia',
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    oversText: '0',
    extras: 0,
    runRate: 0,
    batting: [],
    bowling: [],
    yetToBat: [],
    declared: false,
    closed: false,
    ...over,
  }
}

function batLine(over: Partial<BattingCardLine> = {}): BattingCardLine {
  return {
    position: 1,
    playerId: 'a1',
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    dismissal: null,
    isStriker: false,
    isNonStriker: false,
    ...over,
  }
}

function bowlLine(over: Partial<BowlingCardLine> = {}): BowlingCardLine {
  return {
    playerId: 'b1',
    balls: 6,
    oversText: '1',
    runs: 6,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    economy: 6,
    isCurrentBowler: false,
    ...over,
  }
}

describe('resultText', () => {
  it('is null while a match is unfinished', () => {
    expect(resultText(null)).toBeNull()
  })

  it('formats a win, a tie and an abandonment', () => {
    expect(resultText({ kind: 'WINNER', teamId: 'Chennai', by: 'RUNS', amount: 12 })).toBe('Chennai won by 12 runs')
    expect(resultText({ kind: 'WINNER', teamId: 'Chennai', by: 'WICKETS', amount: 1 })).toBe('Chennai won by 1 wicket')
    expect(resultText({ kind: 'TIE' })).toBe('Match tied')
    expect(resultText({ kind: 'ABANDONED', reason: 'Rain' })).toBe('Match abandoned: Rain')
    expect(resultText({ kind: 'ABANDONED', reason: null })).toBe('Match abandoned')
  })
})

describe('topScorer', () => {
  it('is null before anyone has faced a ball', () => {
    expect(topScorer(innings({ batting: [batLine()] }))).toBeNull()
  })

  it('picks the most runs, breaking ties on strike rate', () => {
    const picks = topScorer(
      innings({
        batting: [
          batLine({ playerId: 'a1', runs: 30, balls: 20 }),
          batLine({ playerId: 'a2', runs: 30, balls: 15 }),
          batLine({ playerId: 'a3', runs: 11, balls: 5 }),
        ],
      }),
    )
    expect(picks?.playerId).toBe('a2')
  })
})

describe('topBowler', () => {
  it('is null with no bowling', () => {
    expect(topBowler(innings())).toBeNull()
  })

  it('picks the most wickets, breaking ties on the lower economy', () => {
    const picks = topBowler(
      innings({
        bowling: [
          bowlLine({ playerId: 'b1', wickets: 2, economy: 9 }),
          bowlLine({ playerId: 'b2', wickets: 2, economy: 4.5 }),
        ],
      }),
    )
    expect(picks?.playerId).toBe('b2')
  })
})

describe('requirementText', () => {
  const live: LiveScore = {
    status: 'IN_PROGRESS',
    inningsIndex: 1,
    battingTeamId: 'Australia',
    bowlingTeamId: 'India',
    runs: 108,
    wickets: 3,
    oversText: '16',
    oversDecimal: 16,
    runRate: 6.75,
    target: 150,
    requiredRunRate: 10.5,
    freeHit: false,
    declared: false,
    powerplay: false,
    ballsRemaining: 24,
    thisOver: [],
    striker: null,
    nonStriker: null,
    bowler: null,
  }

  it('states the chase', () => {
    expect(requirementText(live)).toBe('Australia need 42 off 24')
  })

  it('is null outside a live chase or once the target is reached', () => {
    expect(requirementText({ ...live, status: 'INNINGS_BREAK' })).toBeNull()
    expect(requirementText({ ...live, target: null })).toBeNull()
    expect(requirementText({ ...live, runs: 150 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/scoring.test.ts`
Expected: FAIL — `resultText is not a function`, etc.

- [ ] **Step 3: Implement**

In `web/src/scoring.ts`, widen the type import on line 1 to include the new types:

```ts
import type { BattingCardLine, BowlingCardLine, Dismissal, Extra, InningsCard, LiveScore, MatchConfig, MatchResult } from '@cricket-app/core'
```

Append:

```ts
/** The headline result line, or null while the match is still going. */
export function resultText(result: MatchResult | null): string | null {
  if (!result) return null
  if (result.kind === 'WINNER') return formatWin(result)
  if (result.kind === 'TIE') return 'Match tied'
  return `Match abandoned${result.reason ? `: ${result.reason}` : ''}`
}

/** The innings' best batter; ties break on strike rate, then on fewer balls. */
export function topScorer(inn: InningsCard): BattingCardLine | null {
  const played = inn.batting.filter((b) => b.balls > 0 || b.out)
  const first = played[0]
  if (!first) return null
  return played.reduce((best, b) => {
    if (b.runs !== best.runs) return b.runs > best.runs ? b : best
    const rate = b.balls > 0 ? b.runs / b.balls : 0
    const bestRate = best.balls > 0 ? best.runs / best.balls : 0
    if (rate !== bestRate) return rate > bestRate ? b : best
    return b.balls < best.balls ? b : best
  }, first)
}

/** The innings' leading wicket-taker; ties break on the lower economy. */
export function topBowler(inn: InningsCard): BowlingCardLine | null {
  const first = inn.bowling[0]
  if (!first) return null
  return inn.bowling.reduce((best, b) => {
    if (b.wickets !== best.wickets) return b.wickets > best.wickets ? b : best
    return b.economy < best.economy ? b : best
  }, first)
}

/** "Australia need 42 off 24" while a chase is live, else null. */
export function requirementText(live: LiveScore): string | null {
  if (live.status !== 'IN_PROGRESS' || live.target == null || live.battingTeamId == null) return null
  const need = Math.max(0, live.target - live.runs)
  if (need === 0) return null
  return `${live.battingTeamId} need ${need} off ${live.ballsRemaining}`
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```powershell
cd web; node ..\node_modules\typescript\bin\tsc --noEmit
```
Expected: exit 0.

```powershell
git add web/src/scoring.ts web/src/scoring.test.ts; git commit -m "Add report headline helpers"
```

- [ ] **Step 6: If Task 1 used its local `resultText`, replace it now**

In `web/src/match.ts`, delete any local `resultText` and import the shared one:

```ts
import { resultText } from './scoring'
```

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run`

Expected: all web tests still pass.

```powershell
git add web/src/match.ts; git commit -m "Reuse scoring.resultText in summarize"
```

---

## Task 6: `MatchReport`

**Files:**
- Create: `web/src/MatchReport.tsx`
- Test: `web/src/MatchReport.test.tsx`

**Interfaces:**
- Consumes: `MatchBundle` from `./match`, `playerName`/`resultText`/`requirementText`/`topScorer`/`topBowler` from `./scoring`, `CommentaryLine` from core.
- Produces: `export function MatchReport(props: { bundle: MatchBundle; commentary: CommentaryLine[] })`

- [ ] **Step 1: Write the failing tests**

Create `web/src/MatchReport.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MatchReport } from './MatchReport'
import { buildConfig, buildEvent, computeBundle, computeCommentary } from './match'
import type { MatchEvent } from '@cricket-app/core'

const config = buildConfig(
  {
    teamAId: 'India',
    teamBId: 'Australia',
    lineups: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
    oversPerInnings: 2,
  },
  'm1',
)

const toss = buildEvent('m1', 1, { type: 'TOSS', winnerTeamId: 'India', winnerDecision: 'BAT' }, 'e1', 't')

const ball = (seq: number, runs: number): MatchEvent =>
  buildEvent(
    'm1',
    seq,
    {
      type: 'BALL',
      over: 0,
      ball: seq - 1,
      runs,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    },
    `e${seq}`,
    't',
  )

describe('MatchReport', () => {
  it('summarises both innings with a top score and best bowling', () => {
    const events = [toss, ball(2, 4), ball(3, 2)]
    const html = renderToStaticMarkup(
      <MatchReport bundle={computeBundle('m1', config, events)} commentary={computeCommentary(config, events)} />,
    )
    expect(html).toContain('India')
    expect(html).toContain('6-0')
    expect(html).toContain('Top score')
    expect(html).toContain('Best bowling')
    expect(html).toContain('Commentary')
  })

  it('shows the result line for a finished match', () => {
    const events = [
      toss,
      ball(2, 4),
      buildEvent('m1', 3, { type: 'END_MATCH', outcome: { kind: 'ABANDONED', reason: 'Rain' } }, 'e3', 't'),
    ]
    const html = renderToStaticMarkup(
      <MatchReport bundle={computeBundle('m1', config, events)} commentary={computeCommentary(config, events)} />,
    )
    expect(html).toContain('Match abandoned: Rain')
  })

  it('says the match is in progress before anything has happened', () => {
    const html = renderToStaticMarkup(<MatchReport bundle={computeBundle('m1', config, [])} commentary={[]} />)
    expect(html).toContain('Match in progress.')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/MatchReport.test.tsx`
Expected: FAIL — cannot resolve `./MatchReport`.

- [ ] **Step 3: Implement**

Create `web/src/MatchReport.tsx`:

```tsx
import type { CommentaryLine } from '@cricket-app/core'
import type { MatchBundle } from './match'
import { playerName, requirementText, resultText, topBowler, topScorer } from './scoring'

interface Props {
  bundle: MatchBundle
  commentary: CommentaryLine[]
}

/** The broadcast-style view: headline, both innings at a glance, then the ball-by-ball feed. */
export function MatchReport({ bundle, commentary }: Props) {
  const { state, live, scorecard } = bundle
  const headline = resultText(bundle.result) ?? requirementText(live)

  return (
    <div className="report">
      <section className="card report-headline">
        <p className={headline ? 'result-line' : 'muted'}>{headline ?? 'Match in progress.'}</p>
      </section>

      {scorecard.innings.map((inn) => {
        const bat = topScorer(inn)
        const bowl = topBowler(inn)
        return (
          <section className="card innings-summary" key={inn.index}>
            <header className="innings-head">
              <h2>{inn.battingTeamId}</h2>
              <span className="score">
                {inn.runs}-{inn.wickets}
              </span>
              <span className="muted">
                ({inn.oversText} ov) · RR {inn.runRate.toFixed(2)}
              </span>
            </header>
            <ul className="report-list">
              {bat && (
                <li>
                  Top score: <strong>{playerName(state.config, bat.playerId)}</strong> {bat.runs} ({bat.balls}b)
                </li>
              )}
              {bowl && (
                <li>
                  Best bowling: <strong>{playerName(state.config, bowl.playerId)}</strong> {bowl.wickets}-{bowl.runs} (
                  {bowl.oversText} ov)
                </li>
              )}
            </ul>
          </section>
        )
      })}

      {commentary.length > 0 && (
        <section className="card">
          <h2>Commentary</h2>
          <ol className="commentary-list">
            {commentary
              .slice()
              .reverse()
              .map((line) => (
                <li className={`commentary-line ${line.kind.toLowerCase()}`} key={line.seq}>
                  {line.text}
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/MatchReport.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and commit**

```powershell
cd web; node ..\node_modules\typescript\bin\tsc --noEmit
```

```powershell
git add web/src/MatchReport.tsx web/src/MatchReport.test.tsx; git commit -m "Add broadcast-style match report"
```

---

## Task 7: Routing

Routing moves out of `App.tsx` so the contract ("`#/match/<id>` still opens Scoring") can be tested.

**Files:**
- Create: `web/src/routes.ts`, `web/src/routes.test.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type Route =
    | { name: 'home' }
    | { name: 'setup' }
    | { name: 'match'; matchId: string; tab: 'scoring' | 'report' }
    | { name: 'signin' }
    | { name: 'profile' }
  export function parseHash(hash: string): Route
  ```

- [ ] **Step 1: Write the failing tests**

Create `web/src/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseHash } from './routes'

describe('parseHash', () => {
  it('treats the empty hash and #/ as home', () => {
    expect(parseHash('')).toEqual({ name: 'home' })
    expect(parseHash('#/')).toEqual({ name: 'home' })
  })

  it('puts setup on #/new', () => {
    expect(parseHash('#/new')).toEqual({ name: 'setup' })
  })

  it('keeps #/match/<id> on the scoring tab (share links)', () => {
    expect(parseHash('#/match/abc')).toEqual({ name: 'match', matchId: 'abc', tab: 'scoring' })
  })

  it('opens the report tab from #/match/<id>/report', () => {
    expect(parseHash('#/match/abc/report')).toEqual({ name: 'match', matchId: 'abc', tab: 'report' })
  })

  it('keeps signin and profile', () => {
    expect(parseHash('#/signin')).toEqual({ name: 'signin' })
    expect(parseHash('#/profile')).toEqual({ name: 'profile' })
  })

  it('falls back to home for unknown routes', () => {
    expect(parseHash('#/nonsense')).toEqual({ name: 'home' })
    expect(parseHash('#/match')).toEqual({ name: 'home' })
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/routes.test.ts`
Expected: FAIL — cannot resolve `./routes`.

- [ ] **Step 3: Implement `routes.ts`**

Create `web/src/routes.ts`:

```ts
export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'match'; matchId: string; tab: 'scoring' | 'report' }
  | { name: 'signin' }
  | { name: 'profile' }

/**
 * Hash routing, so shared links work without any server rewrites.
 * `#/match/<id>` is frozen: it must always open the Scoring tab.
 */
export function parseHash(hash: string): Route {
  const match = /^#\/match\/([^/]+)(?:\/(report))?$/.exec(hash)
  if (match && match[1]) {
    return { name: 'match', matchId: match[1], tab: match[2] ? 'report' : 'scoring' }
  }
  if (hash === '#/new') return { name: 'setup' }
  if (hash === '#/signin') return { name: 'signin' }
  if (hash === '#/profile') return { name: 'profile' }
  return { name: 'home' }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run src/routes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Rewire `App.tsx`**

At the top of `web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { ScoringScreen } from './ScoringScreen'
import { SigninScreen } from './SigninScreen'
import { ProfileScreen } from './ProfileScreen'
import { HomeScreen } from './HomeScreen'
import { parseHash } from './routes'
import type { Route } from './routes'
import { rememberMatch } from './myMatches'
import type { CreateMatchBody, Player } from './api'
import { type LineupEntry, buildLineupRefs, directoryEntry, newLocalEntry, resetLocalIds } from './lineup'
```

Delete the local `type Route` and the local `function parseHash()` from `App.tsx` (now in `routes.ts`).

In `App()`, change the state initialiser and the `hashchange` handler (lines 44–50 of the current file) from `parseHash` (the local function) to the imported one:

```tsx
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHash = (): void => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
```

Then insert a home branch before the existing match branch, and pass the tab into it. The current file has exactly:

```tsx
  if (route.name === 'match') {
    return <ScoringScreen matchId={route.matchId} onLeave={() => { window.location.hash = '' }} />
  }
  ...
  return <SetupFlow />
}
```

Replace that opening with:

```tsx
  if (route.name === 'home') {
    return (
      <HomeScreen
        onNewMatch={() => { window.location.hash = '#/new' }}
        onOpenMatch={(matchId) => { window.location.hash = `#/match/${matchId}/report` }}
      />
    )
  }
  if (route.name === 'match') {
    return (
      <ScoringScreen
        matchId={route.matchId}
        initialTab={route.tab}
        onLeave={() => { window.location.hash = '#/' }}
      />
    )
  }
```

Insert a `setup` branch immediately before the trailing `return <SetupFlow />`:

```tsx
  if (route.name === 'setup') {
    return <SetupFlow />
  }
```

The trailing `return <SetupFlow />` is now unreachable for valid routes; keep it as the fallback (it is the `Route` union's remaining case only if you do not add a `setup` branch). The `signin` (line 55) and `profile` (line 65) branches stay **completely unchanged** — in particular `ProfileScreen onSignedOut` keeps pointing at `'#/'`.

In `SetupFlow`'s `createMatch` handler, remember the new match as soon as it exists. Find:

```tsx
    const created = await api.createMatch(body)
```

and add immediately after it:

```tsx
    rememberMatch(created.matchId)
```

Also update `HomeScreen`'s "no setup at `#/`" implication: the setup screen's own `← Home`/back links, if any, should now point at `#/`. Grep for `location.hash = ''` in `web/src` and change each one to `'#/'` so going "home" always lands on the board:

Run: `cd web; Select-String -Path src\*.tsx,src\*.ts -Pattern "location.hash = ''"`

- [ ] **Step 6: Run the whole web suite and typecheck**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run`
Expected: PASS (previous 64 + new tests).

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0. `ScoringScreen` will report an unknown `initialTab` prop — that is Task 8; if you are committing Task 7 on its own, add the prop in Task 8 first or squash the two commits.

- [ ] **Step 7: Commit**

```powershell
git add web/src/routes.ts web/src/routes.test.ts web/src/App.tsx; git commit -m "Route home board at #/ and setup at #/new"
```

---

## Task 8: The Report tab in `ScoringScreen`

**Files:**
- Modify: `web/src/ScoringScreen.tsx`

**Interfaces:**
- Consumes: `MatchReport` (Task 6), `bundle`/`commentary` already in scope.
- Produces: `ScoringScreen({ matchId, onLeave, initialTab })` where `initialTab?: 'scoring' | 'report' | 'scorecard'` (defaults to `'scoring'`).

- [ ] **Step 1: Widen the tab type and seed it from the route**

Line 23–30 currently read:

```tsx
interface Props {
  ...
}

export function ScoringScreen({ matchId, onLeave }: Props) {
  ...
  const [tab, setTab] = useState<'scoring' | 'scorecard'>('scoring')
```

Change to:

```tsx
interface Props {
  matchId: string
  onLeave: () => void
  initialTab?: 'scoring' | 'report' | 'scorecard'
}

export function ScoringScreen({ matchId, onLeave, initialTab = 'scoring' }: Props) {
  ...
  const [tab, setTab] = useState<'scoring' | 'report' | 'scorecard'>(initialTab)
```

(Keep every other field already in `interface Props` exactly as it is.)

- [ ] **Step 2: Fetch commentary for the report too**

The effect at lines ~69–86 starts with:

```tsx
    if (tab !== 'scorecard') return
```

Change to:

```tsx
    if (tab === 'scoring') return
```

- [ ] **Step 3: Add the tab button**

In the `<nav className="tabs">` block (lines 249–256), insert between Scoring and Scorecard:

```tsx
        <button className={tab === 'report' ? 'tab active' : 'tab'} onClick={() => setTab('report')}>
          Report
        </button>
```

- [ ] **Step 4: Render it**

The tail of the component (lines 466–468) is:

```tsx
      ) : (
        <ScorecardView bundle={bundle} commentary={commentary} />
      )}
```

Change to:

```tsx
      ) : tab === 'report' ? (
        <MatchReport bundle={bundle} commentary={commentary} />
      ) : (
        <ScorecardView bundle={bundle} commentary={commentary} />
      )}
```

Add the import near the other screen imports:

```tsx
import { MatchReport } from './MatchReport'
```

- [ ] **Step 5: Verify manually and by suite**

Run: `cd web; node ..\node_modules\vitest\vitest.mjs run`
Expected: PASS.

Run: `cd web; node ..\node_modules\typescript\bin\tsc --noEmit`
Expected: exit 0.

Then start the dev server and click through:

```powershell
cd web; npm run dev
```

- Open `#/match/<an existing match id>`, confirm the Scoring tab is selected and `#/match/<id>` is unchanged in the URL bar.
- Click **Report**: result line or live equation, both innings with Top score / Best bowling, commentary below.
- Click **Scorecard**: the existing full card, unchanged.
- Click **← Home**: lands on the board.

- [ ] **Step 6: Commit**

```powershell
git add web/src/ScoringScreen.tsx; git commit -m "Add Report tab to the match screen"
```

---

## Task 9: Board and report styles

**Files:**
- Modify: `web/src/index.css`

- [ ] **Step 1: Add the styles**

Append to `web/src/index.css`, reusing the existing colour variables/classes (`.card`, `.btn`, `.muted`, `.banner`):

```css
/* Home board */
.board {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.board-section h2 {
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 8px;
}

.board-list {
  display: grid;
  gap: 12px;
}

.match-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'teams pill'
    'score result';
  gap: 6px 12px;
  align-items: center;
  min-height: 48px;
  text-align: left;
  cursor: pointer;
}

.match-teams {
  grid-area: teams;
  font-weight: 600;
}

.match-card .pill {
  grid-area: pill;
}

.match-score {
  grid-area: score;
  font-variant-numeric: tabular-nums;
}

.match-result {
  grid-area: result;
  font-size: 13px;
}

.pill {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--surface-2);
  color: var(--muted);
}

.pill.live {
  background: var(--danger);
  color: var(--text);
}

.pill.break {
  background: var(--warn);
  color: var(--bg);
}

.pill.done {
  background: var(--accent);
  color: var(--accent-ink);
}

/* Match report */
.report {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-headline .result-line {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.report-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

- [ ] **Step 2: Confirm the variables**

The theme already defines `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--accent`, `--accent-ink`, `--danger`, `--warn` (see the `:root` block at the top of `index.css`). If a name has changed, use the real one — do not introduce a new palette.

Optional sanity check:

Run: `cd web; Select-String -Path src\index.css -Pattern "--muted|--surface-2|--danger|--accent"`

- [ ] **Step 3: Rebuild and eyeball it**

Run: `cd web; npm run build`
Expected: build succeeds.

Run: `cd web; npm run dev`, then check `#/` (board) and `#/match/<id>/report` at 375px and ~1200px wide. Every card and every tab must still be ≥48px tall.

- [ ] **Step 4: Commit**

```powershell
git add web/src/index.css; git commit -m "Style the home board and match report"
```

---

## Task 10: Deploy and prove it live

**Files:** none (release step)

- [ ] **Step 1: Full suite**

Run: `cd C:\Users\IT\cricket-app; npm test`
Expected: all workspaces pass (core + web + server).

Run: `cd C:\Users\IT\cricket-app; npm run typecheck`
Expected: exit 0.

- [ ] **Step 2: Build and stage the deploy**

```powershell
cd C:\Users\IT\cricket-app; npm run build -w @cricket-app/web
```

Wipe `web/dist` into the staged copy (keep its `.vercel`):

```powershell
Remove-Item -Recurse -Force C:\Users\IT\AppData\Local\Temp\opencode\cricket-scorer\assets -ErrorAction SilentlyContinue; Copy-Item -Recurse -Force C:\Users\IT\cricket-app\web\dist\* C:\Users\IT\AppData\Local\Temp\opencode\cricket-scorer\
```

- [ ] **Step 3: Deploy**

```powershell
cd C:\Users\IT\AppData\Local\Temp\opencode\cricket-scorer; vercel deploy --prod --yes
```
Expected: a production URL, and the alias `https://cricket-scorer-gold.vercel.app` updated.

- [ ] **Step 4: Verify live**

Open `https://cricket-scorer-gold.vercel.app`:

1. `#/` shows the board. **Live now** lists the match `f57e1164-47f9-4c67-94e5-ffc91f28b1fa` (India vs Australia) with a LIVE pill and its score.
2. The stray probe row `83b863c3-320d-4e37-957b-229dc40fc2e4` must **not** appear (it does not replay) — this is review focus 1 in production.
3. Click the card → `#/match/…/report` with the report open.
4. Click Scoring, roll a ball, click Report: the score updates without a refresh (Realtime is already proven on this screen).
5. Create a match from `+ New match` → setup → toss; return to `#/` and confirm it appears under **Your matches**.
6. Open the same match link in a second tab: it still opens the Scoring tab.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\IT\cricket-app; git add -A; git commit -m "Ship home board and match report"
```

---

## Self-Review

- **Spec coverage:** C (Home landing with one card per match) → Task 4; B (card opens a broadcast-style report) → Tasks 6/7/8; A (report page also reaches the full scorecard) → Task 8 leaves the Scorecard tab in place. Live now + Your matches → Tasks 2/3/4. Routes → Task 7. No schema change → enforced by Task 3. "Not in this build" (search, filters, pagination, GPS, accounts, notifications) → nothing here implements them.
- **Existing behaviour preserved:** `#/match/<id>` → Task 7 test; Extras sheet, Undo, Share untouched; `packages/core` untouched.
- **New surface area:** `summarize`, `summarizeRows`, `myMatchIds`, `rememberMatch`, `listMatches`, `parseHash`, `resultText`, `topScorer`, `topBowler`, `requirementText`, `MatchCard`, `HomeBoard`, `HomeScreen`, `MatchReport`.
- **One known soft spot:** `listMatches` itself has no unit test (thin Supabase glue); it is covered by the live verification in Task 3 step 3 and Task 10 step 4, and the logic it delegates to is unit-tested.
