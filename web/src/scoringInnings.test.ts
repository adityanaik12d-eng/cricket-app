import { describe, expect, it } from 'vitest'
import type { MatchEvent, BallEvent } from '@cricket-app/core'
import { getBallsForInningsAndOver, parseOvers } from './scoring'

function ball(p: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `e${p.seq ?? 1}`,
    matchId: 'm1',
    seq: p.seq ?? 1,
    ts: '2026-10-08T10:00:00.000Z',
    type: 'BALL',
    over: p.over ?? 0,
    ball: p.ball ?? 0,
    runs: p.runs ?? 0,
    extras: p.extras ?? 'NONE',
    wicket: p.wicket ?? false,
    dismissal: p.dismissal ?? null,
    dismissedPlayerId: p.dismissedPlayerId ?? null,
    batterId: p.batterId ?? 'a1',
    nonStrikerId: p.nonStrikerId ?? 'a2',
    bowlerId: p.bowlerId ?? 'b1',
    fieldingCaptainId: p.fieldingCaptainId ?? 'b1',
    ...p,
  }
}

describe('getBallsForInningsAndOver', () => {
  it('returns balls for the first innings only', () => {
    const events: MatchEvent[] = [
      // Innings 1, over 0
      ball({ seq: 1, over: 0, ball: 0, runs: 1 }),
      ball({ seq: 2, over: 0, ball: 1, runs: 4 }),
      // Innings 2, over 0 (address regression: over goes from 0 to 0, ball from 1 to 0)
      ball({ seq: 3, over: 0, ball: 0, runs: 2, batterId: 'b1', bowlerId: 'a1' }),
      ball({ seq: 4, over: 0, ball: 1, runs: 6, batterId: 'b1', bowlerId: 'a1' }),
    ]

    const innings0Over0 = getBallsForInningsAndOver(events, 0, 0)
    expect(innings0Over0).toHaveLength(2)
    expect(innings0Over0[0].runs).toBe(1)
    expect(innings0Over0[1].runs).toBe(4)

    const innings1Over0 = getBallsForInningsAndOver(events, 1, 0)
    expect(innings1Over0).toHaveLength(2)
    expect(innings1Over0[0].runs).toBe(2)
    expect(innings1Over0[1].runs).toBe(6)
  })

  it('handles wides/no-balls correctly within innings detection', () => {
    const events: MatchEvent[] = [
      // Innings 1, over 0 - includes a wide
      ball({ seq: 1, over: 0, ball: 0, runs: 1 }),
      ball({ seq: 2, over: 0, ball: 0, runs: 1, extras: 'WIDE' }), // same ball number
      ball({ seq: 3, over: 0, ball: 1, runs: 0 }),
      // Innings 2, over 0
      ball({ seq: 4, over: 0, ball: 0, runs: 1, batterId: 'b1', bowlerId: 'a1' }),
    ]

    const innings0Over0 = getBallsForInningsAndOver(events, 0, 0)
    expect(innings0Over0).toHaveLength(3) // wide counted in over 0
    expect(innings0Over0[1].extras).toBe('WIDE')

    const innings1Over0 = getBallsForInningsAndOver(events, 1, 0)
    expect(innings1Over0).toHaveLength(1)
  })

  it('returns empty array for non-existent innings', () => {
    const events: MatchEvent[] = [
      ball({ seq: 1, over: 0, ball: 0, runs: 1 }),
    ]

    expect(getBallsForInningsAndOver(events, 5, 0)).toHaveLength(0)
    expect(getBallsForInningsAndOver(events, 0, 5)).toHaveLength(0)
  })

  it('detects innings boundary when over regresses', () => {
    const events: MatchEvent[] = [
      // Innings 1 goes to over 4
      ball({ seq: 1, over: 4, ball: 0, runs: 1 }),
      ball({ seq: 2, over: 4, ball: 1, runs: 0 }),
      // Innings 2 starts at over 0
      ball({ seq: 3, over: 0, ball: 0, runs: 2, batterId: 'b1', bowlerId: 'a1' }),
    ]

    const innings0Over4 = getBallsForInningsAndOver(events, 0, 4)
    expect(innings0Over4).toHaveLength(2)

    const innings1Over0 = getBallsForInningsAndOver(events, 1, 0)
    expect(innings1Over0).toHaveLength(1)
    expect(innings1Over0[0].runs).toBe(2)
  })
})

describe('parseOvers', () => {
  it('parses whole overs', () => {
    expect(parseOvers('20')).toEqual({ over: 20, ball: 0 })
    expect(parseOvers('0')).toEqual({ over: 0, ball: 0 })
  })

  it('parses overs with balls', () => {
    expect(parseOvers('4.5')).toEqual({ over: 4, ball: 5 })
    expect(parseOvers('0.1')).toEqual({ over: 0, ball: 1 })
  })
})