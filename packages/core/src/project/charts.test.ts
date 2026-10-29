import { describe, expect, it } from 'vitest'
import {
  projectInningsTimeline,
  projectManhattan,
  projectRunRate,
  projectWorm,
  projectWinProbability,
  projectMomentum,
  summariseInnings,
} from './charts.js'
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

describe('projectWinProbability', () => {
  it('returns empty series for first innings', () => {
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 })])
    const wp = projectWinProbability(config, charts)
    expect(wp[0].points).toEqual([])
  })

  it('returns empty series when no target is set', () => {
    // Only one innings (no target set for 2nd innings)
    const charts = projectInningsTimeline(config, [ball({ ball: 0, runs: 4 })])
    const wp = projectWinProbability(config, charts)
    expect(wp).toHaveLength(1)
    expect(wp[0].points).toEqual([])
  })

  it('gives 100% probability when target is reached', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 10), // 1st innings: 10 runs
      ...completeOver(0, 6, 'b1', 'a1'), // 2nd innings: 6 runs
      ...completeOver(1, 5, 'b1', 'a1'), // 2nd innings: 5 more = 11, target reached
    ])
    const wp = projectWinProbability(config, charts)
    expect(wp).toHaveLength(2)
    const lastPoint = wp[1].points[wp[1].points.length - 1]
    expect(lastPoint.probability).toBe(1)
    expect(lastPoint.runsNeeded).toBe(0)
  })

  it('gives 0% probability when all out before target', () => {
    // Create 10 wickets fallen (maxWickets = 10)
    const firstInnings = [...completeOver(0, 50)] // 1st innings: 50 runs
    const secondInnings: BallEvent[] = []
    let batterIdx = 1
    let bowlerIdx = 1
    for (let over = 0; over < 4; over++) {
      // Each over: 2 wickets (6 balls, wickets on first 2)
      secondInnings.push(
        ...Array.from({ length: 6 }, (_, ballNum) =>
          ball({
            over,
            ball: ballNum,
            runs: 0,
            wicket: ballNum < 2,
            dismissal: ballNum < 2 ? 'BOWLED' : null,
            batterId: `b${batterIdx++}`,
            bowlerId: `a${bowlerIdx}`,
          }),
        ),
      )
      bowlerIdx++
    }
    // That's 8 wickets in 4 overs, need 2 more
    // Over 4: 2 more wickets
    secondInnings.push(
      ...Array.from({ length: 2 }, (_, ballNum) =>
        ball({
          over: 4,
          ball: ballNum,
          runs: 0,
          wicket: true,
          dismissal: 'BOWLED',
          batterId: `b${batterIdx++}`,
          bowlerId: `a${bowlerIdx}`,
        }),
      ),
    )

    const charts = projectInningsTimeline(config, [...firstInnings, ...secondInnings])
    const wp = projectWinProbability(config, charts)
    const lastPoint = wp[1].points[wp[1].points.length - 1]
    expect(lastPoint.probability).toBe(0)
    expect(lastPoint.wicketsRemaining).toBe(0)
  })

  it('gives 0% probability when overs run out before target', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 50), // 1st innings: 50 runs
      ...Array.from({ length: 20 }, (_, i) => completeOver(i, 1, 'b1', 'a1')).flat(), // 20 overs, 20 runs
    ])
    const wp = projectWinProbability(config, charts)
    const lastPoint = wp[1].points[wp[1].points.length - 1]
    expect(lastPoint.probability).toBe(0)
    expect(lastPoint.oversRemaining).toBe(0)
  })

  it('shows increasing probability when ahead of required rate', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 20), // 1st innings: 20 runs, target 21
      ...completeOver(0, 4, 'b1', 'a1'), // 2nd over 0: 4 runs
      ...completeOver(1, 4, 'b1', 'a1'), // 2nd over 1: 4 more = 8
      ...completeOver(2, 4, 'b1', 'a1'), // 2nd over 2: 4 more = 12
    ])
    const wp = projectWinProbability(config, charts)
    const probs = wp[1].points.map((p) => p.probability)
    expect(probs[0]).toBeLessThan(probs[1])
    expect(probs[1]).toBeLessThan(probs[2])
    expect(probs[2]).toBeGreaterThan(0.5)
  })

  it('shows decreasing probability when behind required rate', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 50), // 1st innings: 50 runs, target 51
      ...completeOver(0, 1, 'b1', 'a1'), // 2nd over 0: 1 run
      ...completeOver(1, 1, 'b1', 'a1'), // 2nd over 1: 1 more = 2
      ...completeOver(2, 1, 'b1', 'a1'), // 2nd over 2: 1 more = 3
    ])
    const wp = projectWinProbability(config, charts)
    const probs = wp[1].points.map((p) => p.probability)
    expect(probs[0]).toBeGreaterThan(probs[1])
    expect(probs[1]).toBeGreaterThan(probs[2])
    expect(probs[2]).toBeLessThan(0.5)
  })

  it('includes all required fields in each point', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 20),
      ...completeOver(0, 4, 'b1', 'a1'),
      ...completeOver(1, 4, 'b1', 'a1'),
    ])
    const wp = projectWinProbability(config, charts)
    const point = wp[1].points[1]
    expect(point).toHaveProperty('over')
    expect(point).toHaveProperty('overNumber')
    expect(point).toHaveProperty('label')
    expect(point).toHaveProperty('probability')
    expect(point).toHaveProperty('runsNeeded')
    expect(point).toHaveProperty('wicketsRemaining')
    expect(point).toHaveProperty('oversRemaining')
    expect(point).toHaveProperty('currentRunRate')
    expect(point).toHaveProperty('requiredRunRate')
    expect(point.probability).toBeGreaterThanOrEqual(0)
    expect(point.probability).toBeLessThanOrEqual(1)
  })
})

describe('projectMomentum', () => {
  it('returns one point per over', () => {
    const charts = projectInningsTimeline(config, [
      ball({ ball: 0, runs: 4 }),
      ball({ over: 1, ball: 0, runs: 6 }),
    ])
    const momentum = projectMomentum(config, charts)
    expect(momentum[0].points).toHaveLength(2)
  })

  it('tracks run rate and delta correctly', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 4), // over 0: 4 runs -> RR 4
      ...completeOver(1, 8), // over 1: 8 runs -> RR 6, delta +2
      ...completeOver(2, 2), // over 2: 2 runs -> RR 4.67, delta -1.33
    ])
    const momentum = projectMomentum(config, charts)
    expect(momentum[0].points[0].runRate).toBe(4)
    expect(momentum[0].points[1].runRate).toBe(6)
    expect(momentum[0].points[1].runRateDelta).toBeCloseTo(2, 1)
    expect(momentum[0].points[2].runRate).toBeCloseTo(14 / 3, 1)
    expect(momentum[0].points[2].runRateDelta).toBeLessThan(0)
  })

  it('detects boundary clusters', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 0, 'a1', 'b1'), // over 0: 0 boundaries
      ...completeOver(1, 0, 'a1', 'b1'), // over 1: 0 boundaries
      ball({ over: 2, ball: 0, runs: 4 }), // over 2: 4
      ball({ over: 2, ball: 1, runs: 6 }), // over 2: 6
      ball({ over: 2, ball: 2, runs: 4 }), // over 2: 4
    ])
    const momentum = projectMomentum(config, charts)
    const over2 = momentum[0].points[2]
    expect(over2.boundaryFrequency).toBe(3)
    expect(over2.events.some((e) => e.type === 'BOUNDARY_CLUSTER')).toBe(true)
  })

  it('detects wicket clusters', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 0, 'a1', 'b1'), // over 0: 0 wickets
      ...completeOver(1, 0, 'a1', 'b1'), // over 1: 0 wickets
      ball({ over: 2, ball: 0, wicket: true, dismissal: 'BOWLED' }), // over 2: wicket
      ball({ over: 2, ball: 1, wicket: true, dismissal: 'CAUGHT' }), // over 2: wicket
    ])
    const momentum = projectMomentum(config, charts)
    const over2 = momentum[0].points[2]
    expect(over2.wicketFrequency).toBe(2)
    expect(over2.events.some((e) => e.type === 'WICKET_CLUSTER')).toBe(true)
  })

  it('detects run rate surge', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 4), // RR 4
      ...completeOver(1, 10), // RR 7, delta +3
    ])
    const momentum = projectMomentum(config, charts)
    const over1 = momentum[0].points[1]
    expect(over1.runRateDelta).toBeGreaterThanOrEqual(2)
    expect(over1.events.some((e) => e.type === 'RUN_RATE_SURGE')).toBe(true)
  })

  it('detects run rate collapse', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 10), // RR 10
      ...completeOver(1, 2), // RR 6, delta -4
    ])
    const momentum = projectMomentum(config, charts)
    const over1 = momentum[0].points[1]
    expect(over1.runRateDelta).toBeLessThanOrEqual(-2)
    expect(over1.events.some((e) => e.type === 'RUN_RATE_COLLAPSE')).toBe(true)
  })

  it('includes all required fields in each point', () => {
    const charts = projectInningsTimeline(config, [...completeOver(0, 4)])
    const momentum = projectMomentum(config, charts)
    const point = momentum[0].points[0]
    expect(point).toHaveProperty('over')
    expect(point).toHaveProperty('overNumber')
    expect(point).toHaveProperty('label')
    expect(point).toHaveProperty('runRate')
    expect(point).toHaveProperty('runRateDelta')
    expect(point).toHaveProperty('boundariesThisOver')
    expect(point).toHaveProperty('boundaryFrequency')
    expect(point).toHaveProperty('wicketsThisOver')
    expect(point).toHaveProperty('wicketFrequency')
    expect(point).toHaveProperty('events')
    expect(Array.isArray(point.events)).toBe(true)
  })

  it('returns series for each innings', () => {
    const charts = projectInningsTimeline(config, [
      ...completeOver(0, 4, 'a1', 'b1'),
      ...completeOver(0, 1, 'b1', 'a1'),
    ])
    const momentum = projectMomentum(config, charts)
    expect(momentum).toHaveLength(2)
    expect(momentum[0].innings).toBe(0)
    expect(momentum[1].innings).toBe(1)
    expect(momentum[0].battingTeamId).toBe('india')
    expect(momentum[1].battingTeamId).toBe('australia')
  })
})
