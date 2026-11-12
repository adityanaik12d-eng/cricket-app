import { describe, expect, it } from 'vitest'
import { withDefaults } from '@cricket-app/core'
import type { BattingCardLine, BowlingCardLine, InningsCard, LiveScore, MatchConfig, MatchResult } from '@cricket-app/core'
import { EXTRA_GROUPS, buildBallPayload, celebrationForDelivery, formatBowlerFigures, formatWin, isScoringShot, parseOvers, playerName, requirementText, requiresFielder, resolvePositions, resultText, topBowler, topScorer } from './scoring'

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

describe('requiresFielder', () => {
  it('is true for dismissals credited to a fielder', () => {
    expect(requiresFielder('CAUGHT')).toBe(true)
    expect(requiresFielder('RUN_OUT')).toBe(true)
    expect(requiresFielder('STUMPED')).toBe(true)
    expect(requiresFielder('OBSTRUCTING')).toBe(true)
  })

  it('is false for bowler and umpire dismissals', () => {
    expect(requiresFielder('BOWLED')).toBe(false)
    expect(requiresFielder('LBW')).toBe(false)
    expect(requiresFielder('HIT_WICKET')).toBe(false)
  })
})

describe('EXTRA_GROUPS', () => {
  it('offers wide, no-ball, bye and leg-bye run variants', () => {
    const labels = Object.fromEntries(EXTRA_GROUPS.map((g) => [g.label, g.options.map((o) => o.label)]))
    expect(labels).toEqual({
      Wide: ['WD+0', 'WD+1', 'WD+2', 'WD+3', 'WD+4'],
      'No ball': ['NB+0', 'NB+1', 'NB+2', 'NB+3', 'NB+4', 'NB+6'],
      Bye: ['B+1', 'B+2', 'B+3', 'B+4'],
      'Leg bye': ['LB+1', 'LB+2', 'LB+3', 'LB+4'],
    })
  })

  it('maps every option to the correct extra and run count', () => {
    for (const group of EXTRA_GROUPS) {
      for (const option of group.options) {
        const payload = buildBallPayload({ kind: option.kind, runs: option.runs, positions, over: 0, ball: 0 })
        expect(payload.extras).toBe(
          option.kind === 'WIDE' ? 'WIDE'
          : option.kind === 'NO_BALL' ? 'NO_BALL'
          : option.kind === 'BYE' ? 'BYE'
          : 'LEG_BYE',
        )
        expect(payload.runs).toBe(option.runs)
      }
    }
  })
})

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

describe('isScoringShot', () => {
  it('accepts bat runs', () => {
    expect(isScoringShot('RUNS', 1)).toBe(true)
    expect(isScoringShot('RUNS', 4)).toBe(true)
    expect(isScoringShot('RUNS', 6)).toBe(true)
  })

  it('accepts a no-ball struck for runs', () => {
    expect(isScoringShot('NO_BALL', 2)).toBe(true)
  })

  it('rejects dot balls', () => {
    expect(isScoringShot('RUNS', 0)).toBe(false)
  })

  it('rejects extras that are not bat shots', () => {
    expect(isScoringShot('WIDE', 1)).toBe(false)
    expect(isScoringShot('BYE', 1)).toBe(false)
    expect(isScoringShot('LEG_BYE', 1)).toBe(false)
  })

  it('rejects wickets', () => {
    expect(isScoringShot('WICKET', 0)).toBe(false)
    expect(isScoringShot('WICKET', 4)).toBe(false)
  })
})

describe('celebrationForDelivery', () => {
  const config = withDefaults({
    matchId: 'm1',
    teamAId: 'A',
    teamBId: 'B',
    lineups: { A: ['a1'], B: ['b1'] },
  })

  it('returns null for a delivery that earned nothing', () => {
    expect(
      celebrationForDelivery({ runs: 12, wickets: 1 }, { runs: 0, extras: 'NONE', wicket: false }, config),
    ).toBeNull()
  })

  it('celebrates a six', () => {
    const c = celebrationForDelivery({ runs: 18, wickets: 1 }, { runs: 6, extras: 'NONE', wicket: false }, config)
    expect(c?.kind).toBe('six')
    expect(c?.label).toBe('SIX!')
  })

  it('celebrates a wicket', () => {
    const c = celebrationForDelivery({ runs: 18, wickets: 2 }, { runs: 0, extras: 'NONE', wicket: true }, config)
    expect(c?.kind).toBe('wicket')
    expect(c?.label).toBe('WICKET!')
  })

  it('celebrates a four struck off a no-ball', () => {
    const c = celebrationForDelivery({ runs: 21, wickets: 1 }, { runs: 4, extras: 'NO_BALL', wicket: false }, config)
    expect(c?.kind).toBe('boundary')
    expect(c?.label).toBe('FOUR!')
  })

  it('does not call four byes a boundary', () => {
    const c = celebrationForDelivery({ runs: 21, wickets: 1 }, { runs: 4, extras: 'BYE', wicket: false }, config)
    expect(c).toBeNull()
  })

  it('celebrates a milestone the team reached on a wide', () => {
    const c = celebrationForDelivery({ runs: 50, wickets: 0 }, { runs: 0, extras: 'WIDE', wicket: false }, config)
    expect(c?.kind).toBe('milestone')
    expect(c?.milestone).toBe(50)
    expect(c?.label).toBe('50 RUNS')
  })

  it('does not celebrate a wide that crosses nothing', () => {
    const c = celebrationForDelivery({ runs: 21, wickets: 0 }, { runs: 0, extras: 'WIDE', wicket: false }, config)
    expect(c).toBeNull()
  })
})
