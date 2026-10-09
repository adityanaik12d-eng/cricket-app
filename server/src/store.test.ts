import { describe, expect, it } from 'vitest'
import { openDb } from './db.ts'
import { ApiError, MatchStore } from './store.ts'

const config = {
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
  oversPerInnings: 2,
  powerplayOvers: 2,
}

const toss = { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' }

describe('MatchStore persistence', () => {
  it('replays persisted matches on a store restart', () => {
    const db = openDb(':memory:')
    const s1 = new MatchStore(db)
    const record = s1.create(config)
    s1.append(record.matchId, toss)

    const s2 = new MatchStore(db)
    const again = s2.mustGet(record.matchId)
    expect(again.state.status).toBe('IN_PROGRESS')
    expect(again.state.eventCount).toBe(1)
    expect(again.state.lastSeq).toBe(1)
    expect(again.events).toHaveLength(1)
  })

  it('keeps seq monotonic across restarts', () => {
    const db = openDb(':memory:')
    const s1 = new MatchStore(db)
    const record = s1.create(config)
    s1.append(record.matchId, toss)

    const s2 = new MatchStore(db)
    const next = s2.append(record.matchId, {
      type: 'BALL',
      over: 0,
      ball: 0,
      runs: 1,
      extras: 'NONE',
      wicket: false,
      dismissal: null,
      dismissedPlayerId: null,
      batterId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
      fieldingCaptainId: 'b1',
    })
    expect(next.event.seq).toBe(2)
    expect(s2.get(record.matchId)?.state.lastSeq).toBe(2)
  })

  it('all() returns every record with events and state', () => {
    const db = openDb(':memory:')
    const store = new MatchStore(db)
    const r1 = store.create(config)
    store.append(r1.matchId, toss)
    store.create({ ...config, teamAId: 'x1', teamBId: 'x2' })
    const all = store.all()
    expect(all).toHaveLength(2)
    expect(all.find((r) => r.matchId === r1.matchId)?.events).toHaveLength(1)
  })

  it('rejects a duplicate matchId with 409 and keeps the original config', () => {
    const db = openDb(':memory:')
    const store = new MatchStore(db)
    store.create({ ...config, matchId: 'dup-1' })

    let caught: unknown
    try {
      store.create({ ...config, matchId: 'dup-1', teamAId: 'x1', teamBId: 'x2' })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).statusCode).toBe(409)
    expect((caught as ApiError).code).toBe('DUPLICATE_MATCH')
    expect(store.get('dup-1')?.config.teamAId).toBe('teamA')

    const restarted = new MatchStore(db)
    expect(restarted.get('dup-1')?.config.teamAId).toBe('teamA')
  })

  it('unknown match is still 404 after restart', () => {
    const db = openDb(':memory:')
    new MatchStore(db)
    const s2 = new MatchStore(db)
    expect(() => s2.mustGet('nope')).toThrow('not found')
  })
})
