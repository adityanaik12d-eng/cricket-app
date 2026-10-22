import { describe, expect, it } from 'vitest'
import { projectBatterBalls } from './batter-balls.js'
import { withDefaults } from '../config.js'
import type { BallEvent, CorrectionEvent, MatchConfig } from '../types.js'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: {
    A: ['a1', 'a2', 'a3'],
    B: ['b1', 'b2', 'b3'],
  },
  playerRefs: {
    a1: { name: 'Kohli' },
    a2: { name: 'Rohit' },
    b1: { name: 'Bumrah' },
    b2: { name: 'Shaheen' },
  },
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

describe('projectBatterBalls', () => {
  it('returns nothing for an empty log', () => {
    expect(projectBatterBalls([], 'a1')).toEqual([])
  })

  it('lists only the deliveries of the given batter', () => {
    const balls = projectBatterBalls([ball({ ball: 0 }), ball({ ball: 1, batterId: 'a2' }), ball({ ball: 2 })], 'a1')
    expect(balls.map((b) => b.label)).toEqual(['0.1', '0.3'])
  })

  it('labels deliveries as over.ball with a one-based ball number', () => {
    const event = ball({ over: 2, ball: 3 })
    const balls = projectBatterBalls([event], 'a1')
    expect(balls[0]?.label).toBe('2.4')
    expect(balls[0]?.seq).toBe(event.seq)
  })

  it('counts only the runs scored off the bat', () => {
    const balls = projectBatterBalls(
      [ball({ ball: 0, runs: 4 }), ball({ ball: 1, extras: 'BYE', runs: 2 }), ball({ ball: 2, extras: 'NO_BALL', runs: 1 })],
      'a1',
    )
    expect(balls.map((b) => b.runs)).toEqual([4, 0, 1])
  })

  it('marks fours and sixes as boundaries', () => {
    const balls = projectBatterBalls([ball({ ball: 0, runs: 4 }), ball({ ball: 1, runs: 6 }), ball({ ball: 2, runs: 1 })], 'a1')
    expect(balls.map((b) => b.boundary)).toEqual([true, true, false])
  })

  it('marks the delivery on which the batter was dismissed', () => {
    const balls = projectBatterBalls(
      [ball({ ball: 0, wicket: true, dismissal: 'BOWLED', dismissedPlayerId: 'a1' })],
      'a1',
    )
    expect(balls[0]?.wicket).toBe(true)
  })

  it('does not mark a wicket that dismissed the other batter', () => {
    const balls = projectBatterBalls(
      [ball({ ball: 0, wicket: true, dismissal: 'RUN_OUT', dismissedPlayerId: 'a2' })],
      'a1',
    )
    expect(balls[0]?.wicket).toBe(false)
  })

  it('ignores wides, which the batter never faced', () => {
    const balls = projectBatterBalls([ball({ ball: 0, extras: 'WIDE', runs: 1 })], 'a1')
    expect(balls).toEqual([])
  })

  it('keeps a no-ball that the batter scored from', () => {
    const balls = projectBatterBalls([ball({ ball: 0, extras: 'NO_BALL', runs: 2 })], 'a1')
    expect(balls).toHaveLength(1)
    expect(balls[0]?.runs).toBe(2)
  })

  it('honours corrections instead of repeating the superseded delivery', () => {
    const original = ball({ ball: 0, runs: 1 })
    const balls = projectBatterBalls(
      [original, correction(original.id, { ball: 0, runs: 4 })],
      'a1',
    )
    expect(balls).toHaveLength(1)
    expect(balls[0]?.runs).toBe(4)
  })

  it('splits the match into innings when an innings index is given', () => {
    const first = projectBatterBalls([ball({ ball: 0 }), ball({ ball: 1 })], 'a1', 0)
    expect(first).toHaveLength(2)

    const second = projectBatterBalls([ball({ ball: 0 }), ball({ ball: 1 }), ball({ ball: 0 })], 'a1', 1)
    expect(second.map((b) => b.label)).toEqual(['0.1'])

    const both = projectBatterBalls([ball({ ball: 0 }), ball({ ball: 1 }), ball({ ball: 0 })], 'a1')
    expect(both).toHaveLength(3)
  })
})
