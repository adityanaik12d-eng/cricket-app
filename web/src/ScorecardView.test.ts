import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BallEvent, CommentaryLine, InningsCard, MatchConfig, MatchState, Scorecard } from '@cricket-app/core'
import { BattingTable, ScorecardView, batterRowKey, toggleRowKey } from './ScorecardView'

const config = {
  matchId: 'm1',
  teamAId: 'Team Alpha',
  teamBId: 'Team Beta',
  lineups: { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2'] },
  oversPerInnings: 2,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 1,
  maxWickets: 2,
  powerplayOvers: 1,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 5,
  playerRefs: {
    a1: { name: 'Aarav Shah' },
    a2: { name: 'Bilal Khan' },
    a3: { name: 'Chetan Rao' },
    b1: { name: 'Danish Ali' },
    b2: { name: 'Eshan Verma' },
  },
} as MatchConfig

const innings: InningsCard = {
  index: 0,
  battingTeamId: 'Team Alpha',
  bowlingTeamId: 'Team Beta',
  runs: 20,
  wickets: 1,
  legalBalls: 12,
  oversText: '2.0',
  extras: 2,
  runRate: 10,
  batting: [
    {
      position: 1,
      playerId: 'a1',
      runs: 12,
      balls: 8,
      fours: 1,
      sixes: 1,
      out: true,
      dismissal: 'CAUGHT',
      isStriker: true,
      isNonStriker: false,
    },
    {
      position: 2,
      playerId: 'a2',
      runs: 6,
      balls: 4,
      fours: 1,
      sixes: 0,
      out: false,
      dismissal: null,
      isStriker: false,
      isNonStriker: true,
    },
  ],
  bowling: [
    {
      playerId: 'b1',
      balls: 12,
      oversText: '2.0',
      runs: 18,
      wickets: 1,
      wides: 0,
      noBalls: 0,
      economy: 9,
      isCurrentBowler: true,
    },
  ],
  yetToBat: ['a3'],
  declared: false,
  closed: true,
}

const scorecard: Scorecard = {
  status: 'COMPLETED',
  innings: [innings],
  result: { kind: 'WINNER', teamId: 'Team Beta', by: 'RUNS', amount: 5 },
}

const state = {
  config,
  status: 'COMPLETED',
  toss: null,
  innings: [],
  overrideResult: null,
  lastSeq: 0,
  eventCount: 0,
} as MatchState

describe('ScorecardView', () => {
  it('resolves player names everywhere and never leaks raw player ids', () => {    const html = renderToStaticMarkup(createElement(ScorecardView, { bundle: { state, scorecard } }))
    expect(html).toContain('Aarav Shah')
    expect(html).toContain('Bilal Khan')
    expect(html).toContain('Danish Ali')
    expect(html).toContain('Chetan Rao')
    for (const id of ['a1', 'a2', 'a3', 'b1', 'b2']) {
      expect(html).not.toContain(id)
    }
  })

  it('renders commentary newest-first when provided', () => {
    const commentary: CommentaryLine[] = [
      { seq: 1, kind: 'TOSS', over: null, text: 'Team Alpha won the toss and chose to bat' },
      { seq: 2, kind: 'OVER', over: null, text: 'Over 1' },
      { seq: 3, kind: 'BALL', over: '0.1', text: '0.1 Danish Ali to Aarav Shah, FOUR' },
    ]
    const html = renderToStaticMarkup(
      createElement(ScorecardView, { bundle: { state, scorecard }, commentary }),
    )
    expect(html).toContain('Commentary')
    expect(html).toContain('FOUR')
    // newest-first: the last ball is rendered above the toss line
    expect(html.indexOf('FOUR')).toBeLessThan(html.indexOf('won the toss'))
  })

  it('omits the commentary card when there are no lines', () => {
    const html = renderToStaticMarkup(createElement(ScorecardView, { bundle: { state, scorecard } }))
    expect(html).not.toContain('Commentary')
  })

  it('renders lines sharing a sequence number without duplicate-key warnings', () => {
    const commentary: CommentaryLine[] = [
      { seq: 5, kind: 'OVER', over: null, text: 'Over 1' },
      { seq: 5, kind: 'BALL', over: '0.1', text: '0.1 Danish Ali to Aarav Shah, no run' },
      { seq: 6, kind: 'BALL', over: '0.2', text: '0.2 Danish Ali to Aarav Shah, FOUR' },
    ]
    const errors: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map((a) => String(a)).join(' '))
    }
    try {
      renderToStaticMarkup(
        createElement(ScorecardView, { bundle: { state, scorecard }, commentary }),
      )
    } finally {
      console.error = original
    }
    expect(errors.some((e) => e.includes('same key'))).toBe(false)
    expect(errors.some((e) => e.includes('key'))).toBe(false)
  })
})

const ballEvent = (p: Partial<BallEvent> = {}): BallEvent => ({
  id: 'e1',
  matchId: 'm1',
  seq: 1,
  ts: '2026-10-21T10:00:00.000Z',
  type: 'BALL',
  over: 3,
  ball: 2,
  runs: 4,
  extras: 'NONE',
  wicket: false,
  dismissal: null,
  dismissedPlayerId: null,
  batterId: 'a1',
  nonStrikerId: 'a2',
  bowlerId: 'b1',
  fieldingCaptainId: 'b1',
  ...p,
})

const events: BallEvent[] = [
  ballEvent({ id: 'e1', seq: 1, over: 3, ball: 2, runs: 4 }),
  ballEvent({ id: 'e2', seq: 2, over: 3, ball: 3, runs: 6, batterId: 'a2' }),
  ballEvent({
    id: 'e3',
    seq: 3,
    over: 3,
    ball: 4,
    runs: 0,
    wicket: true,
    dismissal: 'BOWLED',
    dismissedPlayerId: 'a1',
  }),
]

describe('expandable batting rows', () => {
  const panelTag = (html: string, inningsIndex: number, position: number): string =>
    html.match(new RegExp(`<tr id="batter-balls-${inningsIndex}-${position}"[^>]*>`))?.[0] ?? ''

  it('renders a collapsed toggle for every batting row', () => {
    const html = renderToStaticMarkup(
      createElement(BattingTable, {
        state,
        innings,
        events,
        expanded: new Set<string>(),
        onToggle: () => {},
      }),
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="batter-balls-0-1"')
    expect(html).toContain('aria-controls="batter-balls-0-2"')
  })

  it('hides the ball-by-ball until the row is expanded', () => {
    const html = renderToStaticMarkup(
      createElement(BattingTable, {
        state,
        innings,
        events,
        expanded: new Set<string>(),
        onToggle: () => {},
      }),
    )
    expect(panelTag(html, 0, 1)).toContain('hidden')
    expect(html).not.toContain('3.3')
  })

  it('shows the ball-by-ball of the expanded row', () => {
    const html = renderToStaticMarkup(
      createElement(BattingTable, {
        state,
        innings,
        events,
        expanded: new Set([batterRowKey(0, 1)]),
        onToggle: () => {},
      }),
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('3.3')
    expect(html).toContain('3.5')
    expect(panelTag(html, 0, 1)).not.toContain('hidden')
    expect(panelTag(html, 0, 2)).toContain('hidden')
  })

  it('keeps the other rows collapsed while one row is open', () => {
    const html = renderToStaticMarkup(
      createElement(BattingTable, {
        state,
        innings,
        events,
        expanded: new Set([batterRowKey(0, 1)]),
        onToggle: () => {},
      }),
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('opens one row without closing the others', () => {
    const first = toggleRowKey(new Set<string>(), batterRowKey(0, 1))
    const both = toggleRowKey(first, batterRowKey(0, 2))
    expect(both.has(batterRowKey(0, 1))).toBe(true)
    expect(both.has(batterRowKey(0, 2))).toBe(true)
  })

  it('closes a row that is opened twice', () => {
    const key = batterRowKey(0, 1)
    const once = toggleRowKey(new Set<string>(), key)
    const twice = toggleRowKey(once, key)
    expect(twice.has(key)).toBe(false)
  })

  it('gives each innings its own row keys', () => {
    expect(batterRowKey(0, 1)).not.toBe(batterRowKey(1, 1))
  })
})
