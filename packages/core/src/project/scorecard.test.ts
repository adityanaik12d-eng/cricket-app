import { describe, expect, it } from 'vitest'
import { projectScorecard } from './scorecard.js'
import { withDefaults } from '../config.js'
import { emptyInnings, emptyState } from '../state.js'
import type { MatchConfig, MatchState } from '../types.js'

const baseConfig: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
})

function fixtureState(): MatchState {
  const state = emptyState(baseConfig)
  state.status = 'IN_PROGRESS'
  const inn = emptyInnings(0, baseConfig, null)
  inn.runs = 120
  inn.wickets = 3
  inn.legalBalls = 42
  inn.extras = 7
  inn.battingOrder = ['a1', 'a2', 'a3']
  inn.batters = {
    a1: { playerId: 'a1', runs: 45, balls: 30, fours: 5, sixes: 1, out: true, dismissal: 'CAUGHT', outOnSeq: 12 },
    a2: { playerId: 'a2', runs: 30, balls: 20, fours: 3, sixes: 1, out: false, dismissal: null, outOnSeq: null },
    a3: { playerId: 'a3', runs: 20, balls: 15, fours: 2, sixes: 0, out: false, dismissal: null, outOnSeq: null },
  }
  inn.bowlers = {
    b1: { playerId: 'b1', balls: 24, runs: 40, wickets: 2, wides: 1, noBalls: 0 },
    b2: { playerId: 'b2', balls: 18, runs: 35, wickets: 1, wides: 0, noBalls: 1 },
  }
  inn.strikerId = 'a3'
  inn.nonStrikerId = 'a2'
  inn.currentBowlerId = 'b2'
  state.innings.push(inn)
  return state
}

describe('projectScorecard', () => {
  it('returns an empty scorecard before any innings', () => {
    const card = projectScorecard(emptyState(baseConfig))
    expect(card.status).toBe('CREATED')
    expect(card.innings).toEqual([])
    expect(card.result).toBeNull()
  })

  it('projects innings totals and overs', () => {
    const card = projectScorecard(fixtureState())
    expect(card.innings).toHaveLength(1)
    const inn = card.innings[0]
    expect(inn.index).toBe(0)
    expect(inn.battingTeamId).toBe('A')
    expect(inn.bowlingTeamId).toBe('B')
    expect(inn.runs).toBe(120)
    expect(inn.wickets).toBe(3)
    expect(inn.oversText).toBe('7')
    expect(inn.extras).toBe(7)
    expect(inn.runRate).toBe(17.14)
    expect(inn.closed).toBe(false)
    expect(inn.declared).toBe(false)
  })

  it('projects batting lines in batting order with positions', () => {
    const card = projectScorecard(fixtureState())
    const batting = card.innings[0].batting
    expect(batting.map((b) => b.playerId)).toEqual(['a1', 'a2', 'a3'])
    expect(batting.map((b) => b.position)).toEqual([1, 2, 3])
    expect(batting[0]).toMatchObject({
      playerId: 'a1',
      runs: 45,
      balls: 30,
      fours: 5,
      sixes: 1,
      out: true,
      dismissal: 'CAUGHT',
      isStriker: false,
      isNonStriker: false,
    })
    expect(batting[2].isStriker).toBe(true)
    expect(batting[1].isNonStriker).toBe(true)
  })

  it('lists players yet to bat', () => {
    const card = projectScorecard(fixtureState())
    expect(card.innings[0].yetToBat).toEqual(['a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'])
  })

  it('projects bowling figures with overs and economy', () => {
    const card = projectScorecard(fixtureState())
    const bowling = card.innings[0].bowling
    expect(bowling).toHaveLength(2)
    const b1 = bowling.find((b) => b.playerId === 'b1')
    const b2 = bowling.find((b) => b.playerId === 'b2')
    expect(b1).toMatchObject({
      playerId: 'b1',
      balls: 24,
      oversText: '4',
      runs: 40,
      wickets: 2,
      wides: 1,
      noBalls: 0,
      economy: 10,
      isCurrentBowler: false,
    })
    expect(b2).toMatchObject({ oversText: '3', economy: 11.67, isCurrentBowler: true })
  })

  it('includes the match result', () => {
    const state = fixtureState()
    state.overrideResult = { kind: 'WINNER', teamId: 'A', by: 'WICKETS', amount: 7 }
    const card = projectScorecard(state)
    expect(card.result).toEqual({ kind: 'WINNER', teamId: 'A', by: 'WICKETS', amount: 7 })
  })
})
