import { describe, expect, it } from 'vitest'
import { projectLiveScore } from './live.js'
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

function firstInnings(config: MatchConfig, legalBalls: number): MatchState {
  const state = emptyState(config)
  state.status = 'IN_PROGRESS'
  const inn = emptyInnings(0, config, null)
  inn.legalBalls = legalBalls
  state.innings.push(inn)
  return state
}

/** A made 10, so the side batting second is chasing 11. */
function chase(config: MatchConfig, runs: number, legalBalls: number): MatchState {
  const state = emptyState(config)
  state.status = 'IN_PROGRESS'
  const first = emptyInnings(0, config, null)
  first.runs = 10
  first.wickets = 10
  first.closed = true
  const inn = emptyInnings(1, config, null)
  inn.runs = runs
  inn.legalBalls = legalBalls
  inn.strikerId = 'b1'
  inn.nonStrikerId = 'b2'
  inn.currentBowlerId = 'a1'
  state.innings = [first, inn]
  return state
}

describe('projectLiveScore', () => {
  it('reports no target or required rate outside a chase', () => {
    const live = projectLiveScore(firstInnings(baseConfig, 3))
    expect(live.target).toBeNull()
    expect(live.requiredRunRate).toBeNull()
  })

  it('sets the target and required run rate while chasing', () => {
    const cfg = withDefaults({ ...baseConfig, oversPerInnings: 2, powerplayOvers: 1 })
    // 2-over chase (12 balls). 4 scored off 6 balls -> need 7 from 6.
    const live = projectLiveScore(chase(cfg, 4, 6))
    expect(live.target).toBe(11)
    expect(live.ballsRemaining).toBe(6)
    expect(live.requiredRunRate).toBe(7)
  })

  it('flags the powerplay during the opening overs', () => {
    const cfg = withDefaults({ ...baseConfig, powerplayOvers: 1 })
    expect(projectLiveScore(firstInnings(cfg, 0)).powerplay).toBe(true)
    expect(projectLiveScore(firstInnings(cfg, 5)).powerplay).toBe(true)
  })

  it('clears the powerplay flag once the powerplay overs are done', () => {
    const cfg = withDefaults({ ...baseConfig, powerplayOvers: 1 })
    expect(projectLiveScore(firstInnings(cfg, 6)).powerplay).toBe(false)
  })

  it('reports no powerplay when none is configured', () => {
    const cfg = withDefaults({ ...baseConfig, powerplayOvers: 0 })
    expect(projectLiveScore(firstInnings(cfg, 0)).powerplay).toBe(false)
  })

  it('passes through the deliveries of the current over', () => {
    const state = firstInnings(baseConfig, 1)
    state.innings[0].thisOver = [{ label: '0.1', text: '4', wicket: false, runs: 4 }]
    expect(projectLiveScore(state).thisOver).toEqual([
      { label: '0.1', text: '4', wicket: false, runs: 4 },
    ])
  })

  it('has an empty current over before any deliveries', () => {
    expect(projectLiveScore(firstInnings(baseConfig, 0)).thisOver).toEqual([])
  })
})
