import { describe, expect, it } from 'vitest'
import {
  clampDistance,
  normalizeAngle,
  polarToXY,
  projectWagonWheel,
  summariseWagon,
  wagonRunType,
} from './wagon.js'
import type { BallEvent, CorrectionEvent, MatchEvent } from '../types.js'

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
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:00:00.000Z',
    type: 'BALL',
    ...base(),
    ...p,
  }
}
function correction(supersedes: string, patch: Partial<BallEvent>): CorrectionEvent {
  seq += 1
  const b = base()
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:05:00.000Z',
    type: 'CORRECTION',
    supersedes,
    replacement: { kind: 'BALL', ball: { ...b, ...patch } },
    reason: 'fix',
  }
}

describe('normalizeAngle', () => {
  it('wraps into 0-360', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(90)).toBe(90)
    expect(normalizeAngle(370)).toBe(10)
    expect(normalizeAngle(-10)).toBe(350)
    expect(normalizeAngle(-370)).toBe(350)
  })

  it('falls back to 0 for non-finite input', () => {
    expect(normalizeAngle(Number.NaN)).toBe(0)
    expect(normalizeAngle(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('clampDistance', () => {
  it('clamps into 0-1', () => {
    expect(clampDistance(0.5)).toBe(0.5)
    expect(clampDistance(-1)).toBe(0)
    expect(clampDistance(2)).toBe(1)
    expect(clampDistance(Number.NaN)).toBe(0)
  })
})

describe('polarToXY', () => {
  it('maps 0 degrees to straight up', () => {
    const p = polarToXY(0, 1, 100)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(-100)
  })

  it('maps 90 degrees to the right', () => {
    const p = polarToXY(90, 1, 100)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(0)
  })

  it('maps 180 degrees to straight down', () => {
    const p = polarToXY(180, 1, 100)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(100)
  })

  it('maps 270 degrees to the left', () => {
    const p = polarToXY(270, 1, 100)
    expect(p.x).toBeCloseTo(-100)
    expect(p.y).toBeCloseTo(0)
  })

  it('scales with distance', () => {
    const p = polarToXY(0, 0.25, 100)
    expect(p.y).toBeCloseTo(-25)
  })

  it('clamps the distance before scaling', () => {
    expect(polarToXY(0, 3, 100).y).toBeCloseTo(-100)
  })
})

describe('wagonRunType', () => {
  it('buckets runs', () => {
    expect(wagonRunType(0)).toBe('dot')
    expect(wagonRunType(1)).toBe('runs')
    expect(wagonRunType(3)).toBe('runs')
    expect(wagonRunType(4)).toBe('four')
    expect(wagonRunType(6)).toBe('six')
  })
})

describe('projectWagonWheel', () => {
  it('ignores deliveries with no recorded placement', () => {
    const shots = projectWagonWheel([ball({ runs: 4 })])
    expect(shots).toHaveLength(0)
  })

  it('projects deliveries that carry a placement', () => {
    const shots = projectWagonWheel([ball({ over: 2, ball: 3, runs: 4, shotAngle: 45, shotDistance: 0.8 })])
    expect(shots).toHaveLength(1)
    expect(shots[0]).toMatchObject({
      over: 2,
      ball: 3,
      batterId: 'a1',
      runs: 4,
      angle: 45,
      distance: 0.8,
      wicket: false,
    })
  })

  it('defaults a missing distance to the full radius', () => {
    const shots = projectWagonWheel([ball({ runs: 1, shotAngle: 90 })])
    expect(shots[0].distance).toBe(1)
  })

  it('normalises the angle', () => {
    const shots = projectWagonWheel([ball({ runs: 1, shotAngle: -90 })])
    expect(shots[0].angle).toBe(270)
  })

  it('sorts by sequence', () => {
    const shots = projectWagonWheel([
      ball({ runs: 1, shotAngle: 10 }),
      ball({ runs: 1, shotAngle: 20 }),
    ])
    expect(shots.map((s) => s.angle)).toEqual([10, 20])
  })

  it('filters by batter', () => {
    const events = [
      ball({ batterId: 'a1', runs: 1, shotAngle: 10 }),
      ball({ batterId: 'a2', runs: 4, shotAngle: 20 }),
    ]
    const shots = projectWagonWheel(events, { batterId: 'a2' })
    expect(shots).toHaveLength(1)
    expect(shots[0].batterId).toBe('a2')
  })

  it('filters by run count', () => {
    const events = [
      ball({ runs: 1, shotAngle: 10 }),
      ball({ runs: 4, shotAngle: 20 }),
      ball({ runs: 6, shotAngle: 30 }),
    ]
    const shots = projectWagonWheel(events, { runs: [4, 6] })
    expect(shots.map((s) => s.runs)).toEqual([4, 6])
  })

  it('applies corrections so a corrected placement replaces the original', () => {
    const first = ball({ runs: 4, shotAngle: 10 })
    const events: MatchEvent[] = [first, correction(first.id, { runs: 4, shotAngle: 200, shotDistance: 0.5 })]
    const shots = projectWagonWheel(events)
    expect(shots).toHaveLength(1)
    expect(shots[0].angle).toBe(200)
    expect(shots[0].distance).toBe(0.5)
  })

  it('ignores non-ball events', () => {
    const events: MatchEvent[] = [
      {
        id: 't1',
        matchId: 'm1',
        seq: 1,
        ts: '2026-10-08T10:00:00.000Z',
        type: 'TOSS',
        winnerTeamId: 'A',
        winnerDecision: 'BAT',
      },
    ]
    expect(projectWagonWheel(events)).toHaveLength(0)
  })
})

describe('summariseWagon', () => {
  it('totals shots, runs, fours and sixes', () => {
    const shots = projectWagonWheel([
      ball({ runs: 4, shotAngle: 10 }),
      ball({ runs: 6, shotAngle: 20 }),
      ball({ runs: 1, shotAngle: 30 }),
    ])
    expect(summariseWagon(shots)).toEqual({ shots: 3, runs: 11, fours: 1, sixes: 1 })
  })

  it('handles an empty wheel', () => {
    expect(summariseWagon([])).toEqual({ shots: 0, runs: 0, fours: 0, sixes: 0 })
  })
})
