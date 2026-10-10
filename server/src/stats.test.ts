import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { MatchStore } from './store.ts'
import { computeCareerStats } from './stats.ts'

const lineups = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
}

const config = {
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups,
  oversPerInnings: 2,
  powerplayOvers: 2,
}

function ball(over: number, ball: number, runs: number, extra: Record<string, unknown> = {}) {
  return {
    type: 'BALL',
    over,
    ball,
    runs,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
    ...extra,
  }
}

describe('computeCareerStats', () => {
  let db: DatabaseSync
  let store: MatchStore

  beforeEach(() => {
    db = openDb(':memory:')
    store = new MatchStore(db)
  })

  it('folds batting and bowling numbers across matches', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    store.append(m1.matchId, ball(0, 0, 4))
    store.append(m1.matchId, ball(0, 1, 6))
    store.append(
      m1.matchId,
      ball(0, 2, 0, {
        wicket: true,
        dismissal: 'CAUGHT',
        dismissedPlayerId: 'a1',
        fielderId: 'b3',
      }),
    )

    const a1 = computeCareerStats(store.all(), 'a1')
    expect(a1).toMatchObject({
      matches: 1,
      runs: 10,
      balls: 3,
      fours: 1,
      sixes: 1,
      highest: 10,
      notOuts: 0,
      catches: 0,
    })
    expect(a1.batting).toEqual({ innings: 1, outCount: 1, average: 10, strikeRate: 333.33 })

    const b1 = computeCareerStats(store.all(), 'b1')
    expect(b1).toMatchObject({ matches: 1, wickets: 1, runsConceded: 10, oversBowled: '0.3', bestBowling: '1/10' })
    expect(b1.bowling).toEqual({ innings: 1, economy: 20, average: 10 })

    const b3 = computeCareerStats(store.all(), 'b3')
    expect(b3).toMatchObject({ matches: 1, catches: 1 })
    expect(b3.fielding).toEqual({ dismissals: 1 })
  })

  it('only counts matches the player is in the lineup of', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })

    const other = store.create({ ...config, teamAId: 'x1', teamBId: 'x2' })
    store.append(other.matchId, { type: 'TOSS', winnerTeamId: 'x1', winnerDecision: 'BAT' })

    expect(computeCareerStats(store.all(), 'a1').matches).toBe(2)
    expect(computeCareerStats(store.all(), 'zzz').matches).toBe(0)
  })

  it('returns zeros for a player with no matches', () => {
    const stats = computeCareerStats(store.all(), 'nobody')
    expect(stats).toMatchObject({
      matches: 0,
      runs: 0,
      highest: 0,
      notOuts: 0,
      wickets: 0,
      oversBowled: '0.0',
      bestBowling: '-',
    })
    expect(stats.batting).toEqual({ innings: 0, outCount: 0, average: 0, strikeRate: 0 })
    expect(stats.fielding).toEqual({ dismissals: 0 })
  })

  it('never throws on matches without playerRefs or fielderId', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    store.append(m1.matchId, ball(0, 0, 1))
    expect(() => computeCareerStats(store.all(), 'a1')).not.toThrow()
  })

  it('does not credit a fielder for a caught wicket corrected away', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    const caught = store.append(
      m1.matchId,
      ball(0, 0, 0, { wicket: true, dismissal: 'CAUGHT', dismissedPlayerId: 'a1', fielderId: 'b3' }),
    )
    store.append(m1.matchId, {
      type: 'CORRECTION',
      supersedes: caught.event.id,
      reason: 'was actually a dot ball',
      replacement: { kind: 'BALL', ball: ball(0, 0, 0) },
    })

    const b3 = computeCareerStats(store.all(), 'b3')
    expect(b3.catches).toBe(0)
    expect(b3.fielding).toEqual({ dismissals: 0 })
  })

  it('credits the replacement fielder after a correction', () => {
    const m1 = store.create(config)
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    const caught = store.append(
      m1.matchId,
      ball(0, 0, 0, { wicket: true, dismissal: 'CAUGHT', dismissedPlayerId: 'a1', fielderId: 'b3' }),
    )
    store.append(m1.matchId, {
      type: 'CORRECTION',
      supersedes: caught.event.id,
      reason: 'wrong fielder',
      replacement: {
        kind: 'BALL',
        ball: ball(0, 0, 0, { wicket: true, dismissal: 'CAUGHT', dismissedPlayerId: 'a1', fielderId: 'b5' }),
      },
    })

    expect(computeCareerStats(store.all(), 'b3').catches).toBe(0)
    expect(computeCareerStats(store.all(), 'b5').catches).toBe(1)
  })

  it('computes economy using the match ballsPerOver', () => {
    const m1 = store.create({ ...config, ballsPerOver: 3 })
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    store.append(m1.matchId, ball(0, 0, 4))
    store.append(m1.matchId, ball(0, 1, 4))
    store.append(m1.matchId, ball(0, 2, 4))

    const b1 = computeCareerStats(store.all(), 'b1')
    // 12 runs in 3 balls = 1 over at 3 balls/over -> economy 12 (not 24).
    expect(b1.oversBowled).toBe('1.0')
    expect(b1.bowling.economy).toBe(12)
  })

  it('keeps oversBowled consistent with economy across matches with different ballsPerOver', () => {
    const m1 = store.create(config) // default 6 balls/over
    store.append(m1.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    for (let i = 0; i < 6; i++) store.append(m1.matchId, ball(0, i, 2)) // 6 balls, 12 runs = 1.0 over

    const m2 = store.create({ ...config, ballsPerOver: 3 })
    store.append(m2.matchId, { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' })
    for (let i = 0; i < 3; i++) store.append(m2.matchId, ball(0, i, 2)) // 3 balls, 6 runs = 1.0 over

    const b1 = computeCareerStats(store.all(), 'b1')
    // 18 runs across 2.0 overs -> economy 9; oversBowled must agree (not '3.0').
    expect(b1.oversBowled).toBe('2.0')
    expect(b1.bowling.economy).toBe(9)
  })
})
