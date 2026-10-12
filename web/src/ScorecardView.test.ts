import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CommentaryLine, InningsCard, MatchConfig, MatchState, Scorecard } from '@cricket-app/core'
import { ScorecardView } from './ScorecardView'

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
  it('resolves player names everywhere and never leaks raw player ids', () => {
    const html = renderToStaticMarkup(createElement(ScorecardView, { bundle: { state, scorecard } }))
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
