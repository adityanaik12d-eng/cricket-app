import { describe, expect, it } from 'vitest'
import { applyEvents, applyEvent } from './apply.js'
import { withDefaults } from './config.js'
import type { MatchConfig, BallEvent, TossEvent } from './types.js'

const baseConfig: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
})

describe('apply', () => {
  it('applies toss and sets up first innings', () => {
    const toss: TossEvent = {
      id: 't1',
      matchId: 'm1',
      seq: 1,
      ts: new Date().toISOString(),
      type: 'TOSS',
      winnerTeamId: 'A',
      winnerDecision: 'BAT',
    }
    const state2 = applyEvents(baseConfig, [toss])
    expect(state2.status).toBe('IN_PROGRESS')
    expect(state2.innings.length).toBe(1)
    expect(state2.toss).toBeTruthy()
  })
})