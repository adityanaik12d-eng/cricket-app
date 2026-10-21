import { describe, expect, it } from 'vitest'
import { projectInningsTimeline, projectManhattan, projectRunRate, projectWorm, summariseInnings } from './charts.js'
import { withDefaults } from '../config.js'
import type { BallEvent, CorrectionEvent, MatchConfig, MatchEvent, PenaltyEvent, TossEvent } from '../types.js'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'india',
  teamBId: 'australia',
  lineups: {
    A: ['a1', 'a2', 'a3'],
    B: ['b1', 'b2', 'b3'],
  },
  playerRefs: {
    a1: { name: 'Kohli' },
    a2: { name: 'Rohit' },
    b1: { name: 'Bumrah' },
  },
  oversPerInnings: 20,
  ballsPerOver: 6,
})

let seq = 0
function base(): Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'> {
  return {
    over: 0,
    ball: 0,
    runs: 0,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
  }
}
function ball(p: Partial<BallEvent> = {}): BallEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:00:00.000Z', type: 'BALL', ...base(), ...p }
}
function toss(): TossEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:00:00.000Z', type: 'TOSS', winnerTeamId: 'india', winnerDecision: 'BAT' }
}
function penalty(runs: number, teamId = 'australia'): PenaltyEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:20:00.000Z', type: 'PENALTY', runs, teamId }
}
function correction(supersedes: string, patch: Partial<BallEvent>): CorrectionEvent {
  seq += 1
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:05:00.000Z',
    type: 'CORRECTION',
    supersedes,
    replacement: { kind: 'BALL', ball: { ...base(), ...patch } },
    reason: 'fix',
  }
}

/** Six dot balls, so the over is complete. */
function completeOver(over: number, runs: number, batterId = 'a1', bowlerId = 'b1'): BallEvent[] {
  return Array.from({ length: 6 }, (_, i) => ball({ over, ball: i, runs: i === 0 ? runs : 0, batterId, bowlerId }))
}

describe('projectInningsTimeline', () => {
  it('returns nothing for an empty log', () => {
    expect(projectInningsTimeline(config, [])).toEqual([])
  })

  it('aggregates the deliveries of an over', () => {
    const charts = projectInningsTimeline(config, [
      ball({ ball: 0, runs: 1 }),
      ball({ ball: 1, runs: 4 }),
      ball({ ball: 2, wicket: true, dismissal: 'BOWLED' }),
    ])
    expect(charts).toHaveLength(1)
    expect(charts[0].overs[0]).toMatchObject({
      over: 0,
      overNumber: 1,
      label: 'Over 1',
      runs: 5,
      wickets: 1,
      legalBalls: 3,
    })
    expect(charts[0]).toMatchObject({ runs: 5, wickets: 1, legalBalls: 3, battingTeamId: 'india', bowlingTeamId: 'australia' })
  })

  it('tracks cumulative runs and wickets across overs', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 }), ball({ over: 1, ball: 0, runs: 6 })])
    expect(charts[0].overs.map((o) => o.cumulativeRuns)).toEqual([4, 10])
    expect(charts[0].overs.map((o) => o.overNumber)).toEqual([1, 2])
    expect(charts[0].overs.map((o) => o.label)).toEqual(['Over 1', 'Over 2'])
  })

  it('counts boundary shots from bat runs only', () => {
    const charts = projectInningsTimeline(config, [
      ball({ ball: 0, runs: 1 }),
      ball({ ball: 1, runs: 2 }),
      ball({ ball: 2, runs: 3 }),
      ball({ ball: 3, runs: 4 }),
      ball({ ball: 4, runs: 6 }),
      ball({ ball: 5, extras: 'LEG_BYE', runs: 4 }),
    ])
    expect(charts[0].overs[0].boundaries).toEqual({ ones: 1, twos: 1, threes: 1, fours: 1, sixes: 1 })
  })

  it('does not count extras as boundaries but does add their runs', () => {
    const charts = projectInningsTimeline(config, [
      ball({ ball: 0, extras: 'NO_BALL', runs: 6 }),
      ball({ ball: 1, extras: 'WIDE', runs: 0 }),
    ])
    expect(charts[0].overs[0].boundaries).toEqual({ ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 })
    expect(charts[0].overs[0].runs).toBe(config.noBallExtra + 6 + config.wideExtra)
  })

  it('does not count an illegal delivery as a legal ball', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, extras: 'WIDE', runs: 0 }), ball({ ball: 0, runs: 1 })])
    expect(charts[0].overs).toHaveLength(1)
    expect(charts[0].overs[0].legalBalls).toBe(1)
  })

  it('computes the run rate from legal balls', () => {
    // Three legal balls is half an over, so five runs is a run rate of ten.
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 5 }), ball({ ball: 1, runs: 0 }), ball({ ball: 2, runs: 0 })])
    expect(charts[0].overs[0].runRate).toBe(10)
    expect(charts[0].runRate).toBe(10)
  })

  it('splits the innings when the (over, ball) address regresses', () => {
    const charts = projectInningsTimeline(config, [
      ball({ over: 19, ball: 5, batterId: 'a1', bowlerId: 'b1' }),
      ball({ over: 0, ball: 0, batterId: 'b1', bowlerId: 'a1' }),
    ])
    expect(charts).toHaveLength(2)
    expect(charts[1].innings).toBe(1)
    expect(charts[1].battingTeamId).toBe('australia')
    expect(charts[1].bowlingTeamId).toBe('india')
  })

  it('ignores events that are not deliveries', () => {
    const charts = projectInningsTimeline(config, [toss(), penalty(5), ball()])
    expect(charts).toHaveLength(1)
    expect(charts[0].overs[0].legalBalls).toBe(1)
    expect(charts[0].runs).toBe(0)
  })

  it('honours corrections by reading effective events', () => {
    const dot = ball({ ball: 0, runs: 0 })
    const charts = projectInningsTimeline(config, [dot, correction(dot.id, { runs: 4 })])
    expect(charts[0].overs[0].runs).toBe(4)
    expect(charts[0].runs).toBe(4)
  })

  it('describes the innings as overs and balls', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 1 }), ball({ ball: 1, runs: 0 })])
    expect(charts[0].oversText).toBe('0.2')
  })
})

describe('summariseInnings', () => {
  it('summarises the innings totals', () => {
    const charts = projectInningsTimeline(config, [
      ball({ ball: 0, runs: 4 }),
      ball({ ball: 1, runs: 6 }),
      ball({ ball: 2, wicket: true }),
    ])
    const summary = summariseInnings(charts[0])
    expect(summary).toMatchObject({ innings: 0, runs: 10, wickets: 1, legalBalls: 3, oversText: '0.3' })
    expect(summary.runRate).toBe(20)
    expect(summary.strikeRate).toBeCloseTo(333.33, 1)
    expect(summary.boundaries).toEqual({ ones: 0, twos: 0, threes: 0, fours: 1, sixes: 1 })
  })

  it('finds the best over', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 1 }), ball({ over: 1, ball: 0, runs: 6 })])
    expect(summariseInnings(charts[0]).bestOver?.overNumber).toBe(2)
    expect(summariseInnings(charts[0]).bestOver?.runs).toBe(6)
  })

  it('describes an innings with no deliveries', () => {
    const summary = summariseInnings({
      innings: 0,
      battingTeamId: null,
      bowlingTeamId: null,
      overs: [],
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      runRate: 0,
      oversText: '0.0',
    })
    expect(summary.bestOver).toBeNull()
    expect(summary.runRate).toBe(0)
    expect(summary.strikeRate).toBe(0)
    expect(summary.boundaries).toEqual({ ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 })
  })
})

describe('projectWorm', () => {
  it('gives one cumulative point per completed over', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 }), ball({ over: 1, ball: 0, runs: 6 })])
    const worm = projectWorm(charts)
    expect(worm).toHaveLength(1)
    expect(worm[0].points).toEqual([
      { over: 0, overNumber: 1, label: 'Over 1', runs: 4, wickets: 0 },
      { over: 1, overNumber: 2, label: 'Over 2', runs: 10, wickets: 0 },
    ])
  })

  it('gives one series per innings', () => {
    const charts = projectInningsTimeline(config, [
      ball({ over: 1, ball: 0, batterId: 'a1', bowlerId: 'b1' }),
      ball({ over: 0, ball: 0, batterId: 'b1', bowlerId: 'a1' }),
    ])
    const worm = projectWorm(charts)
    expect(worm).toHaveLength(2)
    expect(worm[1].innings).toBe(1)
    expect(worm[1].battingTeamId).toBe('australia')
  })
})

describe('projectManhattan', () => {
  it('gives one bar per over with the boundary breakdown', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 }), ball({ ball: 1, runs: 1 })])
    const manhattan = projectManhattan(charts)
    expect(manhattan).toHaveLength(1)
    expect(manhattan[0].bars).toHaveLength(1)
    expect(manhattan[0].bars[0]).toMatchObject({ over: 0, overNumber: 1, label: 'Over 1', runs: 5 })
    expect(manhattan[0].bars[0].boundaries).toEqual({ ones: 1, twos: 0, threes: 0, fours: 1, sixes: 0 })
  })
})

describe('projectRunRate', () => {
  it('gives the cumulative run rate after each over', () => {
    const charts = projectInningsTimeline(config, [...completeOver(0, 4), ...completeOver(1, 6)])
    const rates = projectRunRate(config, charts)
    expect(rates[0].points).toHaveLength(2)
    expect(rates[0].points[0].runRate).toBe(4)
    expect(rates[0].points[1].runRate).toBe(5)
  })

  it('has no required rate for the first innings', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 })])
    const rates = projectRunRate(config, charts)
    expect(rates[0].points[0].requiredRate).toBeNull()
  })

  it('gives the chase a required rate from the first innings total', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 4),
      ...completeOver(0, 1, 'b1', 'a1'),
    ])
    const rates = projectRunRate(config, charts)
    expect(rates).toHaveLength(2)
    const chase = rates[1].points[0]
    // Four scored, so five to win off the nineteen overs that are left.
    expect(chase.requiredRate).toBeCloseTo(5 / 19, 6)
  })
})
