import { describe, expect, it } from 'vitest'
import { applyEvents, applyEvent } from './apply.js'
import { withDefaults } from './config.js'
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