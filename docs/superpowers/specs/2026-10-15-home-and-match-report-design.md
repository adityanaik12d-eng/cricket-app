# Design: Home board and match report

Date: 2026-10-15
Status: approved (in chat, 2026-10-15)

## Goal

Give the app a real front door. Today `#/` is the setup form and a match is only
reachable from its share link or immediately after creating it. This adds:

1. a **Home** landing page showing cricket being played right now, plus the
   matches this device created;
2. a **broadcast-style match report** for any match, alongside the existing
   scorecard.

## Scope agreed with the user

The user asked for three things and confirmed "can we use all three option" —
the answer maps to C → B → A:

- **C** — Home is the landing page: one card per match.
- **B** — tapping a card opens a broadcast-style report page.
- **A** — that report page includes the full scorecard we already have.

For the board's contents the user chose **"Live board + your matches"**:
a *Live now* section (every match being scored by anyone) and a
*Your matches* section (the ones created on this device).

## Decisions

1. **Scores for the board are computed in the browser.** `listMatches()`
   returns the ~50 most recently updated rows (`id`, `config`, `events`,
   `updated_at`) and the app replays each with the existing engine through a
   pure `summarize`. No schema change, no duplicated cricket rules, and the
   board can never disagree with the match screen.
2. **Reuse the engine.** Status, score, overs and result text all come from the
   existing projections (`projectLiveScore`, `projectScorecard`,
   `projectResult`, `projectCommentary`).
3. **Realtime, not polling, for the board.** `postgres_changes` on
   `public.matches` already publishes every write; new deliveries and new
   matches appear without a refresh.
4. **"Your matches" is per-device** (`localStorage`), because there are no
   accounts.
5. **A denormalised `summary` column is the upgrade path**, not the starting
   point: it needs a SQL migration plus write-path upkeep, and only pays off
   once the board is large.

## Routes (hash routing — existing share links are unchanged)

| Route | Screen |
| --- | --- |
| `#/` | Home (new landing page) |
| `#/new` | the existing setup → toss flow (moved off `#/`) |
| `#/match/<id>` | the match screen, Scoring tab (what a share link opens) |
| `#/match/<id>/report` | the match screen, Report tab (what a Home card opens) |

## Home

- Top bar: `Cricket Scorer` and a **`+ New match`** button (→ `#/new`).
- **Live now** — a card for every match currently in play (anyone's), most
  recently updated first. Empty state: "Nothing being played right now."
- **Your matches** — matches created on this device, any status.
- **Card** — `India vs Australia`, the score `148-3 (16.2 ov)`, a status pill
  (**LIVE** / **Innings break** / **Result**), and the result line once finished
  (`India won by 24 runs`).
- Updates itself from Realtime, with a manual **Refresh** as a fallback.
- Capped at 50 matches. No search, filters or pagination.

## Match report

A new tab row on the match screen: `Scoring · Report · Scorecard`.

- **Result banner**, or the live requirement (`Australia need 42 off 24`).
- **Both innings** as broadcast-style summaries: score and overs, run rate, and
  the highest-scoring batter and the leading wicket-taker in each innings
  (ties broken by the batter's strike rate and the bowler's economy).
- **Commentary** feed — the ball-by-ball lines the engine already produces.
- The **full scorecard** stays on its own tab, unchanged.

## Code

- `web/src/match.ts` — add a pure `summarize(matchId, config, events)` returning
  a card summary (tested).
- `web/src/myMatches.ts` (new) — `rememberMatch(id)` / `myMatchIds()` over
  `localStorage` (tested).
- `web/src/api.ts` — add `listMatches(limit)`.
- `web/src/HomeScreen.tsx` (new), `web/src/MatchReport.tsx` (new).
- `web/src/App.tsx` — routes; `web/src/ScoringScreen.tsx` — the Report tab and
  the `#/.../report` variant.
- `web/src/index.css` — board and report styles.

## Testing

- TDD at the pure layer: failing tests first for `summarize` and `myMatches`.
- Render tests for the Home cards and the report, using the same
  `renderToStaticMarkup` pattern as `ScorecardView.test.ts` (no jsdom needed).
- Verify the finished feature on the deployed site, as with every previous
  feature.

## Non-goals

Search, filters, pagination, GPS/location, accounts, notifications.

## Risks

- **Download size.** The board pulls up to 50 event logs. Bounded by the cap;
  the `summary` column is the escape hatch.
- **Everyone's matches are listed.** Intended — it is what makes the board feel
  alive, and it is only possible because there is no login.
