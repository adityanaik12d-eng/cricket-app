import { describe, expect, it } from 'vitest'
import { applyEvents, applyEvent } from './apply.js'
import { EngineError } from './errors.js'
import { withDefaults } from './config.js'
import { emptyInnings, emptyState } from './state.js'
import type { MatchConfig, MatchState, BallEvent, TossEvent } from './types.js'

const baseConfig: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
})

const toss: TossEvent = {
  id: 't1',
  matchId: 'm1',
  seq: 1,
  ts: '2026-10-08T10:00:00.000Z',
  type: 'TOSS',
  winnerTeamId: 'A',
  winnerDecision: 'BAT',
}

let seqCounter = 1
function nextSeq(): number {
  seqCounter += 1
  return seqCounter
}
function resetSeq(): void {
  seqCounter = 1
}
function ball(partial: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `e${nextSeq()}`,
    matchId: 'm1',
    seq: seqCounter,
    ts: '2026-10-08T10:01:00.000Z',
    type: 'BALL',
    over: 0,
    ball: seqCounter - 1,
    runs: 0,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b11',
    ...partial,
  }
}

function started(): MatchState {
  resetSeq()
  return applyEvents(baseConfig, [toss])
}

describe('apply', () => {
  it('applies toss and sets up first innings', () => {
    resetSeq()
    const state2 = applyEvents(baseConfig, [toss])
    expect(state2.status).toBe('IN_PROGRESS')
    expect(state2.innings.length).toBe(1)
    expect(state2.toss).toBeTruthy()
  })
})

function autoBowler(inn: { currentBowlerId: string | null; lastOverBowlerId: string | null }): string {
  if (inn.currentBowlerId) return inn.currentBowlerId
  for (const b of ['b1', 'b2', 'b3']) {
    if (b !== inn.lastOverBowlerId) return b
  }
  return 'b1'
}

function ballAt(state: MatchState, partial: Partial<BallEvent> = {}): BallEvent {
  const inn = state.innings[state.innings.length - 1]
  return ball({
    over: inn ? Math.floor(inn.legalBalls / 6) : 0,
    ball: inn ? inn.legalBalls % 6 : 0,
    batterId: inn?.strikerId ?? 'a1',
    nonStrikerId: inn?.nonStrikerId ?? 'a2',
    bowlerId: inn ? autoBowler(inn) : 'b1',
    ...partial,
  })
}

function deliver(state: MatchState, count: number): MatchState {
  let s = state
  for (let i = 0; i < count; i++) {
    s = applyEvent(s.config, s, ballAt(s))
  }
  return s
}

describe('apply: strike rotation and overs', () => {
  it('rotates strike on odd runs', () => {
    const s1 = applyEvent(baseConfig, started(), ballAt(started(), { runs: 1 }))
    expect(s1.innings[0].strikerId).toBe('a2')
    expect(s1.innings[0].nonStrikerId).toBe('a1')
    const s2 = applyEvent(baseConfig, s1, ballAt(s1, { runs: 1 }))
    expect(s2.innings[0].strikerId).toBe('a1')
  })

  it('keeps strike on even runs', () => {
    const s1 = applyEvent(baseConfig, started(), ballAt(started(), { runs: 2 }))
    expect(s1.innings[0].strikerId).toBe('a1')
  })

  it('rotates strike at the end of an over and resets the bowler slot', () => {
    const state = deliver(started(), 6)
    const inn = state.innings[0]
    expect(inn.legalBalls).toBe(6)
    expect(inn.strikerId).toBe('a2')
    expect(inn.nonStrikerId).toBe('a1')
    expect(inn.lastOverBowlerId).toBe('b1')
    expect(inn.currentBowlerId).toBeNull()
  })

  it('rejects the bowler who bowled the previous over', () => {
    let state = deliver(started(), 6)
    expect(() => applyEvent(baseConfig, state, ballAt(state, { bowlerId: 'b1' }))).toThrow(
      /consecutive/i,
    )
  })

  it('accepts a new bowler at the start of the next over', () => {
    let state = deliver(started(), 6)
    state = applyEvent(baseConfig, state, ballAt(state, { bowlerId: 'b2' }))
    expect(state.innings[0].currentBowlerId).toBe('b2')
  })

  it('rejects a bowler over their quota', () => {
    const cfg = withDefaults({
      matchId: 'm1',
      teamAId: 'A',
      teamBId: 'B',
      maxOversPerBowler: 1,
      lineups: {
        A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
        B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
      },
    })
    resetSeq()
    let state = applyEvents(cfg, [toss])
    for (let i = 0; i < 12; i++) {
      state = applyEvent(cfg, state, ballAt(state))
    }
    // over 0: b1 (6 balls), over 1: b2 (6 balls)
    expect(state.innings[0].bowlers['b1'].balls).toBe(6)
    expect(() => applyEvent(cfg, state, ballAt(state, { bowlerId: 'b1' }))).toThrow(
      /quota/i,
    )
  })

  it('rejects a bowler who is batting', () => {
    expect(() => applyEvent(baseConfig, started(), ballAt(started(), { bowlerId: 'a1' }))).toThrow(
      /batting/i,
    )
  })

  it('rejects a ball whose batter is not on strike', () => {
    let state = applyEvent(baseConfig, started(), ballAt(started()))
    expect(() => applyEvent(baseConfig, state, ballAt(state, { batterId: 'a2' }))).toThrow(
      /strike/i,
    )
  })
})

function mkConfig(partial: Partial<MatchConfig>): MatchConfig {
  return withDefaults({
    matchId: 'm1',
    teamAId: 'A',
    teamBId: 'B',
    lineups: {
      A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
      B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
    },
    ...partial,
  })
}

/** Second innings of a 2-innings match: A made 10, B chasing. */
function chaseState(runs: number, wickets: number): MatchState {
  const cfg = baseConfig
  const state = emptyState(cfg)
  state.status = 'IN_PROGRESS'
  const inn0 = emptyInnings(0, cfg, null)
  inn0.runs = 10
  inn0.wickets = 10
  inn0.closed = true
  const inn1 = emptyInnings(1, cfg, null)
  inn1.runs = runs
  inn1.wickets = wickets
  inn1.strikerId = 'b1'
  inn1.nonStrikerId = 'b2'
  inn1.battingOrder = ['b1', 'b2']
  inn1.batters = {
    b1: { playerId: 'b1', runs: 5, balls: 8, fours: 1, sixes: 0, out: false, dismissal: null, outOnSeq: null },
    b2: { playerId: 'b2', runs: 4, balls: 6, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null },
  }
  inn1.currentBowlerId = 'a1'
  inn1.bowlers = {
    a1: { playerId: 'a1', balls: 12, runs: 8, wickets: wickets, wides: 0, noBalls: 0 },
  }
  state.innings = [inn0, inn1]
  return state
}

function chaseBall(partial: Partial<BallEvent> = {}): BallEvent {
  return ball({
    batterId: 'b1',
    nonStrikerId: 'b2',
    bowlerId: 'a1',
    ...partial,
  })
}

describe('apply: wickets and innings transitions', () => {
  it('records a wicket, brings in the next batter, credits the bowler', () => {
    const state = applyEvent(
      baseConfig,
      started(),
      ballAt(started(), { wicket: true, dismissal: 'BOWLED', dismissedPlayerId: 'a1' }),
    )
    const inn = state.innings[0]
    expect(inn.wickets).toBe(1)
    expect(inn.batters['a1']).toMatchObject({ out: true, dismissal: 'BOWLED', outOnSeq: 2 })
    expect(inn.bowlers['b1'].wickets).toBe(1)
    expect(inn.battingOrder).toEqual(['a1', 'a2', 'a3'])
    expect(inn.strikerId).toBe('a3')
    expect(inn.nonStrikerId).toBe('a2')
  })

  it('does not credit the bowler for a run out', () => {
    const state = applyEvent(
      baseConfig,
      started(),
      ballAt(started(), { wicket: true, dismissal: 'RUN_OUT', dismissedPlayerId: 'a1' }),
    )
    expect(state.innings[0].wickets).toBe(1)
    expect(state.innings[0].bowlers['b1'].wickets).toBe(0)
    expect(state.innings[0].batters['a1'].out).toBe(true)
  })

  it('closes the innings when all wickets fall and starts the next', () => {
    const cfg = mkConfig({ maxWickets: 1 })
    resetSeq()
    let state = applyEvents(cfg, [toss])
    state = applyEvent(
      cfg,
      state,
      ballAt(state, { wicket: true, dismissal: 'BOWLED', dismissedPlayerId: 'a1' }),
    )
    expect(state.innings[0].closed).toBe(true)
    expect(state.innings).toHaveLength(2)
    expect(state.status).toBe('INNINGS_BREAK')
    expect(state.innings[1].battingTeamId).toBe('B')
    expect(state.innings[1].bowlingTeamId).toBe('A')
  })

  it('closes the innings when overs are exhausted', () => {
    const cfg = mkConfig({ oversPerInnings: 1 })
    resetSeq()
    let state = applyEvents(cfg, [toss])
    state = deliver(state, 6)
    expect(state.innings[0].closed).toBe(true)
    expect(state.innings).toHaveLength(2)
    expect(state.status).toBe('INNINGS_BREAK')
  })

  it('ends the match when the chase succeeds', () => {
    const state = applyEvent(baseConfig, chaseState(10, 8), chaseBall({ runs: 1 }))
    expect(state.innings[1].closed).toBe(true)
    expect(state.status).toBe('COMPLETED')
    expect(state.overrideResult).toEqual({ kind: 'WINNER', teamId: 'B', by: 'WICKETS', amount: 2 })
  })

  it('awards the match to the bowling side when the chase falls short', () => {
    const state = applyEvent(baseConfig, chaseState(5, 9), chaseBall({ wicket: true, dismissal: 'BOWLED', dismissedPlayerId: 'b1' }))
    expect(state.innings[1].closed).toBe(true)
    expect(state.status).toBe('COMPLETED')
    expect(state.overrideResult).toEqual({ kind: 'WINNER', teamId: 'A', by: 'RUNS', amount: 5 })
  })

  it('declares the innings', () => {
    let state = applyEvent(baseConfig, started(), ballAt(started()))
    state = applyEvent(baseConfig, state, {
      id: 'e3',
      matchId: 'm1',
      seq: 3,
      ts: '2026-10-08T10:05:00.000Z',
      type: 'DECLARE',
    })
    expect(state.innings[0].declared).toBe(true)
    expect(state.innings[0].closed).toBe(true)
    expect(state.status).toBe('INNINGS_BREAK')
    expect(state.innings).toHaveLength(2)
  })

  it('adds penalty runs to the penalised team total', () => {
    let state = applyEvent(baseConfig, started(), ballAt(started(), { runs: 4 }))
    state = applyEvent(baseConfig, state, {
      id: 'e3',
      matchId: 'm1',
      seq: 3,
      ts: '2026-10-08T10:05:00.000Z',
      type: 'PENALTY',
      runs: 5,
      teamId: 'A',
    })
    expect(state.innings[0].runs).toBe(9) // 4 off the bat + 5 penalty? see below
  })

  it('ends the match on END_MATCH', () => {
    let state = applyEvent(baseConfig, started(), ballAt(started()))
    state = applyEvent(baseConfig, state, {
      id: 'e3',
      matchId: 'm1',
      seq: 3,
      ts: '2026-10-08T10:05:00.000Z',
      type: 'END_MATCH',
      outcome: { kind: 'ABANDONED', reason: 'Rain' },
    })
    expect(state.status).toBe('ABANDONED')
    expect(state.overrideResult).toEqual({ kind: 'ABANDONED', reason: 'Rain' })
  })
})

describe('apply: corrections', () => {
  it('replays a corrected ball in place of the original', () => {
    resetSeq()
    const original = ball({ runs: 4 })
    const state = applyEvents(baseConfig, [
      toss,
      original,
      {
        id: 'c1',
        matchId: 'm1',
        seq: 3,
        ts: '2026-10-08T10:03:00.000Z',
        type: 'CORRECTION',
        supersedes: original.id,
        reason: 'tapped 4 instead of 6',
        replacement: {
          kind: 'BALL',
          ball: {
            over: 0,
            ball: 1,
            runs: 6,
            extras: 'NONE',
            wicket: false,
            dismissal: null,
            dismissedPlayerId: null,
            batterId: 'a1',
            nonStrikerId: 'a2',
            bowlerId: 'b1',
            fieldingCaptainId: 'b11',
          },
        },
      },
    ])
    // Only the corrected value counts — not both.
    expect(state.innings[0].runs).toBe(6)
    expect(state.innings[0].batters['a1'].runs).toBe(6)
    expect(state.innings[0].batters['a1'].sixes).toBe(1)
    expect(state.innings[0].legalBalls).toBe(1)
    expect(state.eventCount).toBe(3)
  })
})

describe('apply: ball scoring', () => {
  it('scores bat runs on a legal delivery', () => {
    const state = applyEvent(baseConfig, started(), ball({ runs: 4 }))
    const inn = state.innings[0]
    expect(inn.runs).toBe(4)
    expect(inn.legalBalls).toBe(1)
    expect(inn.strikerId).toBe('a1')
    expect(inn.nonStrikerId).toBe('a2')
    expect(inn.currentBowlerId).toBe('b1')
    expect(inn.battingOrder).toEqual(['a1', 'a2'])
    expect(inn.batters['a1']).toMatchObject({ runs: 4, balls: 1, fours: 1, sixes: 0, out: false })
    expect(inn.bowlers['b1']).toMatchObject({ balls: 1, runs: 4, wickets: 0, wides: 0, noBalls: 0 })
  })

  it('adds wide penalty without counting a legal ball', () => {
    const state = applyEvent(baseConfig, started(), ball({ extras: 'WIDE', runs: 2 }))
    const inn = state.innings[0]
    expect(inn.runs).toBe(3) // 1 penalty + 2 run
    expect(inn.extras).toBe(3)
    expect(inn.legalBalls).toBe(0)
    expect(inn.batters['a1']).toBeUndefined() // never faced a legal ball
    expect(inn.bowlers['b1']).toMatchObject({ balls: 0, runs: 3, wides: 1 })
  })

  it('credits byes as extras, not batter runs', () => {
    const state = applyEvent(baseConfig, started(), ball({ extras: 'BYE', runs: 2 }))
    const inn = state.innings[0]
    expect(inn.runs).toBe(2)
    expect(inn.extras).toBe(2)
    expect(inn.legalBalls).toBe(1)
    expect(inn.batters['a1']).toMatchObject({ runs: 0, balls: 1 })
    expect(inn.bowlers['b1']).toMatchObject({ balls: 1, runs: 0 })
  })

  it('credits leg-byes as extras, not batter runs', () => {
    const state = applyEvent(baseConfig, started(), ball({ extras: 'LEG_BYE', runs: 1 }))
    const inn = state.innings[0]
    expect(inn.runs).toBe(1)
    expect(inn.extras).toBe(1)
    expect(inn.legalBalls).toBe(1)
    expect(inn.batters['a1']).toMatchObject({ runs: 0, balls: 1 })
    expect(inn.bowlers['b1']).toMatchObject({ balls: 1, runs: 0 })
  })

  it('adds no-ball penalty plus bat runs without counting a legal ball', () => {
    const state = applyEvent(baseConfig, started(), ball({ extras: 'NO_BALL', runs: 1 }))
    const inn = state.innings[0]
    expect(inn.runs).toBe(2) // 1 penalty + 1 off bat
    expect(inn.extras).toBe(1)
    expect(inn.legalBalls).toBe(0)
    expect(inn.batters['a1']).toMatchObject({ runs: 1, balls: 0 })
    expect(inn.bowlers['b1']).toMatchObject({ balls: 0, runs: 2, noBalls: 1 })
  })

  it('counts sixes', () => {
    const state = applyEvent(baseConfig, started(), ball({ runs: 6 }))
    expect(state.innings[0].batters['a1']).toMatchObject({ runs: 6, sixes: 1 })
  })
})

describe('apply: error reporting', () => {
  it('throws EngineError carrying the validation code for an illegal delivery', () => {
    const started2 = started()
    const afterFirst = applyEvent(baseConfig, started2, ball({ runs: 0 }))
    let caught: unknown
    try {
      applyEvent(baseConfig, afterFirst, ball({ batterId: 'a3' }))
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(EngineError)
    expect((caught as EngineError).code).toBe('POSITION')
  })

  it('throws EngineError for an unknown innings target on PENALTY', () => {
    let caught: unknown
    try {
      applyEvent(baseConfig, started(), {
        id: 'p1',
        matchId: 'm1',
        seq: 2,
        ts: '2026-10-08T10:02:00.000Z',
        type: 'PENALTY',
        runs: 5,
        teamId: 'Z',
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('No innings for penalised team')
  })
})

it('fielderId on a ball event does not change scoring', () => {
  const before = started()
  const plain = ballAt(before, {})
  const plainState = applyEvent(before.config, before, plain)

  const other = started()
  const withFielder = ballAt(other, { fielderId: 'b2' })
  const fielderState = applyEvent(other.config, other, withFielder)

  expect(withFielder.fielderId).toBe('b2')
  expect(fielderState).toEqual(plainState)
})