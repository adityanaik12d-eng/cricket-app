import { describe, expect, it } from 'vitest'
import { projectCommentary } from './commentary.js'
import { withDefaults } from '../config.js'
import type { BallEvent, CorrectionEvent, EndMatchEvent, MatchConfig, MatchEvent, PenaltyEvent, TossEvent, DeclareEvent } from '../types.js'

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
function toss(decision: 'BAT' | 'BOWL' = 'BAT'): TossEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:00:00.000Z', type: 'TOSS', winnerTeamId: 'A', winnerDecision: decision }
}
function declare(): DeclareEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:30:00.000Z', type: 'DECLARE' }
}
function penalty(runs: number, teamId = 'B'): PenaltyEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:20:00.000Z', type: 'PENALTY', runs, teamId }
}
function endMatch(outcome: EndMatchEvent['outcome']): EndMatchEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T11:00:00.000Z', type: 'END_MATCH', outcome }
}
function correction(supersedes: string, ball: Partial<BallEvent>): CorrectionEvent {
  seq += 1
  const b = base()
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:05:00.000Z',
    type: 'CORRECTION',
    supersedes,
    replacement: { kind: 'BALL', ball: { ...b, ...ball } },
    reason: 'fix',
  }
}

function ballLines(lines: ReturnType<typeof projectCommentary>) {
  return lines.filter((l) => l.kind === 'BALL' || l.kind === 'WICKET')
}

describe('projectCommentary', () => {
  it('returns nothing for an empty log', () => {
    expect(projectCommentary(config, [])).toEqual([])
  })

  it('opens with the toss result', () => {
    const lines = projectCommentary(config, [toss()])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ kind: 'TOSS', text: 'A won the toss and chose to bat' })
  })

  it('emits an over header before the deliveries of each over', () => {
    const lines = projectCommentary(config, [toss(), ball(), ball({ ball: 1 })])
    expect(lines[0].kind).toBe('TOSS')
    expect(lines[1]).toMatchObject({ kind: 'OVER', over: null, text: 'Over 1' })
    expect(ballLines(lines)).toHaveLength(2)
  })

  it('describes a boundary, a single and a dot ball', () => {
    const lines = projectCommentary(config, [
      toss(),
      ball({ ball: 0, runs: 4 }),
      ball({ ball: 1, runs: 1 }),
      ball({ ball: 2, runs: 0 }),
    ])
    const texts = ballLines(lines).map((l) => l.text)
    expect(texts).toEqual([
      '0.1 Bumrah to Kohli, FOUR',
      '0.2 Bumrah to Kohli, 1 run',
      '0.3 Bumrah to Kohli, no run',
    ])
    expect(ballLines(lines)[0].over).toBe('0.1')
  })

  it('labels the second over and the deliveries within it', () => {
    const lines = projectCommentary(config, [
      toss(),
      ball({ over: 1, ball: 0, runs: 6 }),
    ])
    expect(lines.some((l) => l.kind === 'OVER' && l.text === 'Over 2')).toBe(true)
    expect(ballLines(lines)[0]).toMatchObject({ over: '1.1', text: '1.1 Bumrah to Kohli, SIX' })
  })

  it('describes wides (total includes the mandatory extra)', () => {
    const one = projectCommentary(config, [toss(), ball({ extras: 'WIDE', runs: 0 })])
    expect(ballLines(one)[0].text).toBe('0.1 Bumrah to Kohli, wide')
    const many = projectCommentary(config, [toss(), ball({ extras: 'WIDE', runs: 4 })])
    expect(ballLines(many)[0].text).toBe('0.1 Bumrah to Kohli, 5 wides')
  })

  it('describes no-balls with and without runs off the bat', () => {
    const plain = projectCommentary(config, [toss(), ball({ extras: 'NO_BALL', runs: 0 })])
    expect(ballLines(plain)[0].text).toBe('0.1 Bumrah to Kohli, no ball')
    const boundary = projectCommentary(config, [toss(), ball({ extras: 'NO_BALL', runs: 6 })])
    expect(ballLines(boundary)[0].text).toBe('0.1 Bumrah to Kohli, no ball, SIX')
  })

  it('describes byes and leg byes', () => {
    const bye = projectCommentary(config, [toss(), ball({ extras: 'BYE', runs: 2 })])
    expect(ballLines(bye)[0].text).toBe('0.1 Bumrah to Kohli, 2 byes')
    const legBye = projectCommentary(config, [toss(), ball({ extras: 'LEG_BYE', runs: 1 })])
    expect(ballLines(legBye)[0].text).toBe('0.1 Bumrah to Kohli, 1 leg bye')
  })

  it('describes a caught wicket with the fielder, and a bowled without one', () => {
    const caught = projectCommentary(config, [
      toss(),
      ball({ wicket: true, dismissal: 'CAUGHT', dismissedPlayerId: 'a1', fielderId: 'b2' }),
    ])
    const w = ballLines(caught)[0]
    expect(w.kind).toBe('WICKET')
    expect(w.text).toBe('0.1 Bumrah to Kohli, WICKET! Kohli caught by Shaheen')

    const bowled = projectCommentary(config, [
      toss(),
      ball({ wicket: true, dismissal: 'BOWLED', dismissedPlayerId: 'a1' }),
    ])
    expect(ballLines(bowled)[0].text).toBe('0.1 Bumrah to Kohli, WICKET! Kohli bowled')
  })

  it('shows the corrected delivery and hides the superseded one', () => {
    const original = ball({ runs: 0 })
    const lines = projectCommentary(config, [toss(), original, correction(original.id, { runs: 4 })])
    const texts = ballLines(lines).map((l) => l.text)
    expect(texts).toEqual(['0.1 Bumrah to Kohli, FOUR'])
  })

  it('falls back to the raw id when a player has no ref', () => {
    const lines = projectCommentary(config, [toss(), ball({ batterId: 'a9', bowlerId: 'b9' })])
    expect(ballLines(lines)[0].text).toBe('0.1 b9 to a9, no run')
  })

  it('marks a declaration and an innings break, then restarts the over count', () => {
    const lines = projectCommentary(config, [toss(), ball({ over: 2, ball: 5 }), declare(), ball({ over: 0, ball: 0, runs: 1 })])
    const kinds = lines.map((l) => l.kind)
    expect(kinds).toContain('INNINGS')
    const declaredLine = lines.find((l) => l.kind === 'INNINGS')
    expect(declaredLine?.text).toBe('Innings declared')
    // the new innings opens a fresh "Over 1" header
    const overHeaders = lines.filter((l) => l.kind === 'OVER').map((l) => l.text)
    expect(overHeaders).toEqual(['Over 3', 'Over 1'])
  })

  it('marks an innings break even when an innings lasts a single over', () => {
    const firstInnings = [0, 1, 2, 3, 4, 5].map((b) => ball({ over: 0, ball: b }))
    const lines = projectCommentary(config, [
      toss(),
      ...firstInnings,
      ball({ over: 0, ball: 0, runs: 1 }),
    ])
    expect(lines.some((l) => l.kind === 'INNINGS' && l.text === 'Innings break')).toBe(true)
    const overHeaders = lines.filter((l) => l.kind === 'OVER').map((l) => l.text)
    expect(overHeaders).toEqual(['Over 1', 'Over 1'])
  })

  it('does not repeat the over header when a penalty interrupts an over', () => {
    const lines = projectCommentary(config, [
      toss(),
      ball({ over: 0, ball: 0 }),
      penalty(2, 'B'),
      ball({ over: 0, ball: 1, runs: 1 }),
    ])
    const overHeaders = lines.filter((l) => l.kind === 'OVER').map((l) => l.text)
    expect(overHeaders).toEqual(['Over 1'])
    expect(lines.some((l) => l.kind === 'INNINGS' && l.text === 'Penalty runs: 2 to B')).toBe(true)
  })

  it('reports the end of the match', () => {
    expect(projectCommentary(config, [endMatch({ kind: 'TIE' })])[0]).toMatchObject({ kind: 'END', text: 'Match tied' })
    expect(projectCommentary(config, [endMatch({ kind: 'ABANDONED', reason: 'rain' })])[0]).toMatchObject({
      kind: 'END',
      text: 'Match abandoned: rain',
    })
  })

  it('is a pure function of ordered events (ignores CORRECTION lines as deliveries)', () => {
    const original = ball({ runs: 1 })
    const events: MatchEvent[] = [toss(), original, correction(original.id, { runs: 2 })]
    const lines = projectCommentary(config, events)
    expect(ballLines(lines)).toHaveLength(1)
  })
})
