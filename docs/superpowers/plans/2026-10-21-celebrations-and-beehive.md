# Celebrations, polish and beehive heat map (Phases 5 + 6)

Phases 1–4 of the Broadcast Glass redesign are done, tested and **live** at
`https://cricket-scorer-gold.vercel.app`. This plan covers the two remaining
phases the user approved with "go for all the remaining".

## Global constraints

- Plain CSS only (`web/src/index.css` is the single stylesheet). No UI/CSS
  framework. No new runtime dependency.
- Animate **only** `transform` / `opacity`. Respect `prefers-reduced-motion`.
- New `BallEvent` fields must be **optional** so old matches still load.
- Every new pure function gets a Vitest test, written **before** the
  implementation, and watched failing first.
- `packages/core` must be **built** before the web typecheck/tests run (the web
  app resolves `@cricket-app/core` through its `dist/`).
- Keep the scoring pad fast and plain: no heavy effects on the pad itself.
- Work directly on `master` (standing user permission), no worktree.
- Never name a subagent `model` (harness forbids it).

## Task list

| # | Task | Produces | Consumes |
|---|------|----------|----------|
| 1 | Celebration engine (core) | `packages/core/src/project/celebrate.ts` | `types.ts` |
| 2 | Celebration overlay (web) | `web/src/ui/Celebration.tsx` + CSS | Task 1 types |
| 3 | Wire celebration into scoring | `web/src/ScoringScreen.tsx` | Tasks 1–2 |
| 4 | View Transitions for hash routes | `web/src/ui/viewTransition.ts`, `App.tsx`, CSS | — |
| 5 | Expandable scorecard rows | `web/src/ScorecardView.tsx` + CSS | `bundle.events` |
| 6 | Phase 5 verification | screenshots + green suite | Tasks 1–5 |
| 7 | Beehive geometry (core) | `packages/core/src/project/beehive.ts` | `wagon.ts` maths |
| 8 | Beehive view (web) + Wheel-tab toggle | `web/src/ui/Beehive.tsx`, `ScoringScreen.tsx`, CSS | Task 7 |
| 9 | Phase 6 verification | screenshots + green suite | Tasks 7–8 |
| 10 | Deploy + live verification | live site updated | Tasks 1–9 |

---

## Task 1 — Celebration engine (core)

**File:** `packages/core/src/project/celebrate.ts` (+ `celebrate.test.ts`),
exported from `packages/core/src/index.ts`.

```ts
export type CelebrationKind = 'none' | 'boundary' | 'six' | 'wicket' | 'milestone'
export type CelebrationTier = 'none' | 'small' | 'big' | 'huge'

export interface CelebrationInput {
  /** Runs scored off the delivery. */
  runs: number
  /** True when the delivery took a wicket. */
  isWicket: boolean
  /** Team wickets after the delivery. */
  wickets: number
  /** Team runs AFTER the delivery. */
  teamRuns: number
}

export interface DeliveryCelebration {
  kind: CelebrationKind
  label: string
  runs: number
  wickets: number
  /** The 50/100/… mark crossed by this delivery, else null. */
  milestone: number | null
  tier: CelebrationTier
}

export function nextMilestone(runs: number): number
export function milestoneReached(prevRuns: number, newRuns: number): number | null
export function celebrateDelivery(input: CelebrationInput): DeliveryCelebration
```

Semantics:

- Milestones are **multiples of 50** (50, 100, 150, …).
- `nextMilestone(runs)` → the next multiple of 50 strictly greater than `runs`
  (`nextMilestone(0) === 50`, `nextMilestone(50) === 100`). Non-finite input → 50.
- `milestoneReached(prev, next)` → the highest multiple of 50 that `next`
  reached and `prev` had not, else `null`. `0` never counts as a milestone.
- `celebrateDelivery` derives `prevRuns = teamRuns - runs` and calls
  `milestoneReached`.
- `kind` precedence: **wicket > six > milestone > boundary > none**.
  `runs === 6` → six; `runs === 4` → boundary; `runs` 1/2/3/0 → none.
- `milestone` is set **independently** of `kind`: a six from 48 to 54 is
  `kind: 'six'` with `milestone: 50`.
- `label`: `'WICKET!'`, `'SIX!'`, `'FOUR!'`, `'<n> RUNS'`, `''`.
- `tier`: `none` → `none`; boundary → `small`; six/wicket/milestone → `big`;
  any milestone `>= 100` → `huge`.

## Task 2 — Celebration overlay (web)

**File:** `web/src/ui/Celebration.tsx` (+ `Celebration.test.tsx`), CSS block in
`web/src/index.css`.

- Props `{ celebration: DeliveryCelebration; onDone: () => void }`.
- Renders `null` when `kind === 'none'`.
- Renders `<div class="celebration celebration-<kind>" role="status"
  aria-live="polite">` containing the label and a per-kind effect element:
  boundary → `.celebration-ripple`, six → `.celebration-burst`, wicket →
  `.celebration-stumps` (inline SVG stumps + bails), milestone →
  `.celebration-badge` with the milestone number.
- Auto-dismisses through a `useEffect` timer calling `onDone`; the timer is
  cleared on unmount. Duration prop `durationMs` (default 1800).
- CSS animates only `transform`/`opacity`; under
  `prefers-reduced-motion: reduce` the effects render static (no animation).

## Task 3 — Wire the celebration into scoring

**File:** `web/src/ScoringScreen.tsx`.

- New state `const [celebration, setCelebration] = useState<DeliveryCelebration | null>(null)`.
- Inside `submitBall`, **after** `api.postEvent` resolves: build the
  celebration from `live` (the pre-ball score) and the delivery, and
  `setCelebration` when `kind !== 'none'`.
- Render `<Celebration celebration={celebration} onDone={() => setCelebration(null)} />`
  inside `.shell`.
- A failed post must not celebrate.

## Task 4 — View Transitions for hash routes

**File:** `web/src/ui/viewTransition.ts` (+ `viewTransition.test.ts`),
`web/src/App.tsx`, CSS.

```ts
export interface ViewTransitionHost {
  startViewTransition?: (update: () => void) => unknown
}
export function withViewTransition(update: () => void, host?: ViewTransitionHost | null): void
```

- Calls `host.startViewTransition(update)` when available, otherwise calls
  `update()` directly. No `document` access when there is no host (SSR safe).
- `App.tsx`'s `hashchange` handler routes its `setRoute` through
  `withViewTransition`.
- CSS: `::view-transition-old(root)` / `::view-transition-new(root)` cross-fade
  using opacity/transform only; disabled under `prefers-reduced-motion`.

## Task 5 — Expandable scorecard rows

**File:** `web/src/ScorecardView.tsx` (+ test updates), CSS.

- Each batting row becomes expandable: a toggle button with
  `aria-expanded` and `aria-controls`, showing that batter's ball-by-ball
  (over.ball label, runs, boundary/wicket markers) derived from the match
  events.
- Collapsed by default; expanding one row does not collapse others.
- Pure helper for the per-batter ball list lives in
  `packages/core/src/project/batter-balls.ts` (exported from the core index):
  `projectBatterBalls(events, playerId): BatterBall[]` with
  `BatterBall { seq, label, runs, wicket, boundary }`.

## Task 6 — Phase 5 verification

- `npm run build -w @cricket-app/core`
- `npm run test -w @cricket-app/core`
- `npm run test -w @cricket-app/web`
- `npm run typecheck -w @cricket-app/web`
- `npm run build -w @cricket-app/web`
- Playwright: 360 px + desktop, dark + light, celebration overlay rendered,
  scorecard row expands, no console errors. Screenshots `ui-phase5-*.png`.

## Task 7 — Beehive geometry (core)

**File:** `packages/core/src/project/beehive.ts` (+ `beehive.test.ts`),
exported from the core index.

- Reuse the wagon maths: `polarToXY` gives cartesian ground coordinates with
  0° straight up (down the ground) and distance as a fraction of the radius.
- A **pointy-top hex grid** laid over the ground. Pure functions:
  - `hexCenter(col: number, row: number, radius: number): { x: number; y: number }`
  - `groundToCell(angle: number, distance01: number, radius: number): { col: number; row: number }`
  - `projectBeehive(events: MatchEvent[]): BeehiveCell[]` — every delivery
    carrying `shotAngle`/`shotDistance` is bucketed into a cell; the cell
    carries `{ col, row, balls, runs, fours, sixes }`.
  - `beehiveTone(balls: number): 'none' | 'low' | 'mid' | 'high'` — density
    tier used for colour.
- Only deliveries with a recorded placement are counted (old matches → empty).

## Task 8 — Beehive view (web) + Wheel-tab toggle

**File:** `web/src/ui/Beehive.tsx` (+ `Beehive.test.tsx`), `ScoringScreen.tsx`,
CSS.

- The existing **Wheel tab** gains a two-way toggle: `Wheel | Beehive`
  (`.wheel-view-toggle`), so the tab count stays at five.
- `Beehive.tsx` renders the hex grid as inline SVG: one `<path>`/`<polygon>`
  per cell, coloured by `beehiveTone`, each with a `<title>` tooltip
  ("4 balls · 12 runs"), `role="img"` + `aria-label` on the `<svg>`, plus a
  visually hidden data table.
- Empty state when no placements were recorded, with a hint to turn on
  "Record placement".

## Task 9 — Phase 6 verification

Same command set as Task 6, plus a beehive screenshot set `ui-phase6-*.png`.

## Task 10 — Deploy + live verification

- Build core, build web, stage `web/dist/*` + `.vercel/project.json`,
  `vercel deploy --prod --yes` (recipe in `DEPLOY.md` section 0).
- Verify the live site: new asset hashes, all tabs, both themes, no console
  errors.
