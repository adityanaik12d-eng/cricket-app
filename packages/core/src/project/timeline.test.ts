import { describe, expect, it } from 'vitest'
import { projectTimeline } from './timeline.js'
import { withDefaults } from '../config.js'
import type { BallEvent, CorrectionEvent, MatchConfig, PenaltyEvent, TossEvent } from '../types.js'

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
function toss(): TossEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:00:00.000Z', type: 'TOSS', winnerTeamId: 'A', winnerDecision: 'BAT' }
}
function penalty(runs: number, teamId = 'B'): PenaltyEvent {
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

describe('projectTimeline', () => {
  it('returns nothing for an empty log', () => {
    expect(projectTimeline(config, [])).toEqual([])
  })

  it('groups deliveries by over, in order, with labels', () => {
    const overs = projectTimeline(config, [toss(), ball({ ball: 0 }), ball({ ball: 1, runs: 4 }), ball({ over: 1, ball: 0 })])
    expect(overs).toHaveLength(2)
    expect(overs[0]).toMatchObject({ over: 0, label: 'Over 1', innings: 0 })
    expect(overs[0].balls.map((b) => b.label)).toEqual(['0.1', '0.2'])
    expect(overs[0].balls.map((b) => b.text)).toEqual(['0', '4'])
    expect(overs[1].label).toBe('Over 2')
  })

  it('totals runs and wickets per over and describes a wicket chip', () => {
    const overs = projectTimeline(config, [
      ball({ ball: 0, runs: 4 }),
      ball({ ball: 1, runs: 2 }),
      ball({ ball: 2, wicket: true, dismissal: 'BOWLED' }),
    ])
    expect(overs[0].runs).toBe(6)
    expect(overs[0].wickets).toBe(1)
    expect(overs[0].balls[2]).toMatchObject({ text: 'W', runs: 0, wicket: true, dismissal: 'BOWLED' })
  })

  it('labels extras and counts their penalty runs', () => {
    const overs = projectTimeline(config, [
      ball({ ball: 0, extras: 'WIDE', runs: 0 }),
      ball({ ball: 0, extras: 'NO_BALL', runs: 6 }),
      ball({ ball: 1, extras: 'LEG_BYE', runs: 2 }),
    ])
    const [wide, noBall, legBye] = overs[0].balls
    expect(wide).toMatchObject({ text: 'wd', runs: config.wideExtra })
    expect(noBall).toMatchObject({ text: 'nb6', runs: config.noBallExtra + 6 })
    expect(legBye).toMatchObject({ text: 'lb2', runs: 2 })
  })

  it('opens a new innings when (over, ball) regresses', () => {
    const overs = projectTimeline(config, [
      ball({ over: 19, ball: 5, batterId: 'a1' }),
      ball({ over: 0, ball: 0, batterId: 'b1', bowlerId: 'a1' }),
    ])
    expect(overs.map((o) => o.innings)).toEqual([0, 1])
    expect(overs[1]).toMatchObject({ over: 0, label: 'Over 1' })
  })

  it('keeps wides/no-balls with their over (the ball number does not advance)', () => {
    const overs = projectTimeline(config, [
      ball({ over: 3, ball: 2, extras: 'WIDE' }),
      ball({ over: 3, ball: 2, runs: 1 }),
    ])
    expect(overs).toHaveLength(1)
    expect(overs[0].balls).toHaveLength(2)
    expect(overs[0].balls.map((b) => b.label)).toEqual(['3.3', '3.3'])
  })

  it('ignores events that are not deliveries', () => {
    const overs = projectTimeline(config, [toss(), penalty(5), ball()])
    expect(overs).toHaveLength(1)
    expect(overs[0].balls).toHaveLength(1)
  })

  it('honours corrections by reading effective events', () => {
    const dot = ball({ ball: 0, runs: 0 })
    const overs = projectTimeline(config, [dot, correction(dot.id, { runs: 4 })])
    expect(overs[0].balls).toHaveLength(1)
    expect(overs[0].balls[0]).toMatchObject({ text: '4', runs: 4, seq: dot.seq, wicket: false })
    expect(overs[0].runs).toBe(4)
  })
})
