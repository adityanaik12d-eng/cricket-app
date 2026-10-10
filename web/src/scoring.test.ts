import { describe, expect, it } from 'vitest'
import type { LiveScore, MatchConfig, MatchResult } from '@cricket-app/core'
import { buildBallPayload, formatBowlerFigures, formatWin, parseOvers, playerName, resolvePositions } from './scoring'

const positions = { strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' }

function liveFixture(partial: Partial<LiveScore> = {}): LiveScore {
  return {
    status: 'IN_PROGRESS',
    inningsIndex: 0,
    battingTeamId: 'teamA',
    bowlingTeamId: 'teamB',
    runs: 12,
    wickets: 1,
    oversText: '2.3',
    oversDecimal: 2.5,
    runRate: 4.8,
    target: null,
    requiredRunRate: null,
    freeHit: false,
    declared: false,
    powerplay: false,
    ballsRemaining: 9,
    thisOver: [],
    striker: null,
    nonStriker: null,
    bowler: null,
    ...partial,
  }
}

describe('parseOvers', () => {
  it('parses whole overs', () => {
    expect(parseOvers('20')).toEqual({ over: 20, ball: 0 })
  })

  it('parses partial overs', () => {
    expect(parseOvers('4.5')).toEqual({ over: 4, ball: 5 })
  })

  it('parses zero', () => {
    expect(parseOvers('0')).toEqual({ over: 0, ball: 0 })
  })
})

describe('resolvePositions', () => {
  it('prefers live engine positions when set', () => {
    const live = liveFixture({
      striker: { playerId: 'a3', runs: 5, balls: 4, fours: 1, sixes: 0, out: false, dismissal: null, outOnSeq: null },
      nonStriker: { playerId: 'a4', runs: 1, balls: 2, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null },
      bowler: { playerId: 'b2', balls: 6, runs: 4, wickets: 0, wides: 0, noBalls: 0 },
    })
    expect(resolvePositions(live, positions)).toEqual({
      strikerId: 'a3',
      nonStrikerId: 'a4',
      bowlerId: 'b2',
    })
  })

  it('falls back to overrides when the innings has no positions yet', () => {
    expect(resolvePositions(liveFixture(), positions)).toEqual(positions)
  })

  it('falls back per position when only some are known', () => {
    const live = liveFixture({
      striker: { playerId: 'a3', runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null },
    })
    expect(resolvePositions(live, positions)).toEqual({
      strikerId: 'a3',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
    })
  })
})

describe('buildBallPayload', () => {
  it('builds a normal scoring ball', () => {
    const payload = buildBallPayload({
      kind: 'RUNS',
      runs: 4,
      positions,
      over: 2,
      ball: 3,
    })
    expect(payload).toEqual({
      type: 'BALL',
      over: 2,
      ball: 3,
      runs: 4,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    })
  })

  it('builds a wide with no legal ball and no bat runs', () => {
    const payload = buildBallPayload({ kind: 'WIDE', runs: 0, positions, over: 0, ball: 0 })
    expect(payload.extras).toBe('WIDE')
    expect(payload.runs).toBe(0)
    expect(payload.wicket).toBe(false)
  })

  it('builds a no-ball carrying optional bat runs', () => {
    const payload = buildBallPayload({ kind: 'NO_BALL', runs: 1, positions, over: 1, ball: 2 })
    expect(payload.extras).toBe('NO_BALL')
    expect(payload.runs).toBe(1)
  })

  it('builds byes and leg-byes with their run count', () => {
    expect(buildBallPayload({ kind: 'BYE', runs: 2, positions, over: 0, ball: 0 }).extras).toBe('BYE')
    expect(buildBallPayload({ kind: 'BYE', runs: 2, positions, over: 0, ball: 0 }).runs).toBe(2)
    expect(buildBallPayload({ kind: 'LEG_BYE', runs: 1, positions, over: 0, ball: 0 }).extras).toBe('LEG_BYE')
  })

  it('builds a wicket ball with dismissal details for the striker', () => {
    const payload = buildBallPayload({
      kind: 'WICKET',
      runs: 0,
      dismissal: 'BOWLED',
      positions,
      over: 3,
      ball: 1,
    })
    expect(payload.wicket).toBe(true)
    expect(payload.dismissal).toBe('BOWLED')
    expect(payload.dismissedPlayerId).toBe('a1')
    expect(payload.extras).toBe('NONE')
  })

  it('rejects a wicket without a dismissal', () => {
    expect(() => buildBallPayload({ kind: 'WICKET', runs: 0, positions, over: 0, ball: 0 })).toThrow(
      'dismissal required',
    )
  })
})

describe('formatWin', () => {
  it('pluralises wickets and runs correctly', () => {
    expect(formatWin({ kind: 'WINNER', teamId: 'australia', by: 'WICKETS', amount: 10 })).toBe(
      'australia won by 10 wickets',
    )
    expect(formatWin({ kind: 'WINNER', teamId: 'india', by: 'WICKETS', amount: 1 })).toBe(
      'india won by 1 wicket',
    )
    expect(formatWin({ kind: 'WINNER', teamId: 'india', by: 'RUNS', amount: 5 })).toBe(
      'india won by 5 runs',
    )
    expect(formatWin({ kind: 'WINNER', teamId: 'india', by: 'RUNS', amount: 1 })).toBe(
      'india won by 1 run',
    )
  })
})

describe('formatBowlerFigures', () => {
  it('formats overs without float rounding', () => {
    expect(formatBowlerFigures(1, 4, 0)).toBe('0.1-4-0')
    expect(formatBowlerFigures(6, 12, 2)).toBe('1.0-12-2')
    expect(formatBowlerFigures(7, 12, 2)).toBe('1.1-12-2')
    expect(formatBowlerFigures(0, 0, 0)).toBe('0.0-0-0')
  })
})

const cfgWithRefs = {
  matchId: 'dummy-match-id',
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups: { A: [], B: [] },
  oversPerInnings: 20,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 4,
  maxWickets: 10,
  powerplayOvers: 6,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 5,
  playerRefs: {
    'p-1': { name: 'Virat K', mobile: '9876543210', verified: true },
    'india-3': { name: 'Rohit', verified: false },
  },
} as MatchConfig

describe('playerName', () => {
  it('resolves directory and local names', () => {
    expect(playerName(cfgWithRefs, 'p-1')).toBe('Virat K')
    expect(playerName(cfgWithRefs, 'india-3')).toBe('Rohit')
  })

  it('falls back to the raw id for old matches and unknown players', () => {
    const empty = {
  matchId: 'dummy-match-id',
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups: { A: [], B: [] },
  oversPerInnings: 20,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 4,
  maxWickets: 10,
  powerplayOvers: 6,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 5,
  playerRefs: {},
} as MatchConfig
    expect(playerName(empty, 'india-1')).toBe('india-1')
    expect(playerName(cfgWithRefs, 'zzz')).toBe('zzz')
  })
})

describe('buildBallPayload with fielderId', () => {
  it('includes fielderId when a fielder is credited', () => {
    const payload = buildBallPayload({
      kind: 'WICKET',
      runs: 0,
      dismissal: 'CAUGHT',
      positions: { strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' },
      over: 0,
      ball: 2,
      fielderId: 'b3',
    })
    expect(payload).toMatchObject({ dismissal: 'CAUGHT', fielderId: 'b3', dismissedPlayerId: 'a1' })
  })

  it('omits fielderId when not credited', () => {
    const payload = buildBallPayload({
      kind: 'WICKET',
      runs: 0,
      dismissal: 'BOWLED',
      positions: { strikerId: 'a1', nonStrikerId: 'a2', bowlerId: 'b1' },
      over: 0,
      ball: 2,
    })
    expect('fielderId' in payload).toBe(false)
  })
})
