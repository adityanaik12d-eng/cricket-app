import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.ts'
import { openDb } from './db.ts'
import { MatchStore } from './store.ts'

const lineups = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
}

const validConfig = {
  teamAId: 'teamA',
  teamBId: 'teamB',
  lineups,
  oversPerInnings: 2,
  powerplayOvers: 2,
}

function ballPayload(over: number, ball: number, runs: number) {
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
  }
}

const tossPayload = { type: 'TOSS', winnerTeamId: 'teamA', winnerDecision: 'BAT' }

describe('server API', () => {
  let app: FastifyInstance
  let store: MatchStore

  beforeEach(async () => {
    store = new MatchStore(openDb(':memory:'))
    app = await buildApp(store)
  })

  afterEach(async () => {
    await app.close()
  })

  async function createMatch(config: unknown = validConfig) {
    return app.inject({ method: 'POST', url: '/matches', payload: config as object })
  }

  async function startMatch() {
    const created = await createMatch()
    const matchId = (created.json() as { matchId: string }).matchId
    const toss = await app.inject({
      method: 'POST',
      url: `/matches/${matchId}/events`,
      payload: tossPayload,
    })
    return { matchId, toss }
  }

  it('POST /matches creates a match and returns live score', async () => {
    const res = await createMatch()
    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      matchId: string
      state: { status: string; eventCount: number }
      live: { status: string }
    }
    expect(body.matchId).toBeTruthy()
    expect(body.state.status).toBe('CREATED')
    expect(body.state.eventCount).toBe(0)
    expect(body.live.status).toBe('CREATED')
    expect(store.get(body.matchId)).toBeDefined()
  })

  it('POST /matches rejects an invalid config with 400', async () => {
    const res = await createMatch({ teamAId: 'teamA', teamBId: 'teamA', lineups })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string; code: string }
    expect(body.code).toBe('INVALID_FORMAT')
    expect(body.error).toBeTruthy()
  })

  it('GET /matches/:id returns state, live and scorecard', async () => {
    const { matchId } = await startMatch()
    const res = await app.inject({ method: 'GET', url: `/matches/${matchId}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      state: { status: string }
      live: { runs: number }
      scorecard: { status: string; innings: unknown[] }
    }
    expect(body.state.status).toBe('IN_PROGRESS')
    expect(body.live.runs).toBe(0)
    expect(body.scorecard.status).toBe('IN_PROGRESS')
    expect(body.scorecard.innings).toHaveLength(1)
  })

  it('GET /matches/:id 404s for unknown match', async () => {
    const res = await app.inject({ method: 'GET', url: '/matches/nope' })
    expect(res.statusCode).toBe(404)
  })

  it('POST /matches/:id/events appends a ball and returns updated live score', async () => {
    const { matchId } = await startMatch()
    const res = await app.inject({
      method: 'POST',
      url: `/matches/${matchId}/events`,
      payload: ballPayload(0, 0, 4),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      seq: number
      state: { lastSeq: number; eventCount: number; innings: { runs: number }[] }
      live: { runs: number }
    }
    expect(body.seq).toBe(2)
    expect(body.state.lastSeq).toBe(2)
    expect(body.state.eventCount).toBe(2)
    expect(body.state.innings[0]?.runs).toBe(4)
    expect(body.live.runs).toBe(4)
  })

  it('server assigns id, matchId, seq and ts to submitted events', async () => {
    const { matchId } = await startMatch()
    await app.inject({ method: 'POST', url: `/matches/${matchId}/events`, payload: ballPayload(0, 0, 1) })
    const events = store.get(matchId)!.events
    const ball = events[1]!
    expect(ball.id).toBeTruthy()
    expect(ball.matchId).toBe(matchId)
    expect(ball.seq).toBe(2)
    expect(typeof ball.ts).toBe('string')
    expect(Number.isNaN(Date.parse(ball.ts))).toBe(false)
  })

  it('POST /matches/:id/events rejects an illegal delivery with 400 and does not mutate state', async () => {
    const { matchId } = await startMatch()
    // second consecutive over by same bowler after over ends is complex; use a simpler
    // violation: ball attributed to a batter who is not on strike (position check)
    await app.inject({ method: 'POST', url: `/matches/${matchId}/events`, payload: ballPayload(0, 0, 0) })
    const before = store.get(matchId)!.state.eventCount
    const res = await app.inject({
      method: 'POST',
      url: `/matches/${matchId}/events`,
      payload: { ...ballPayload(0, 1, 0), batterId: 'a3' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { code: string }
    expect(body.code).toBe('POSITION')
    expect(store.get(matchId)!.state.eventCount).toBe(before)
  })

  it('POST /matches/:id/events 404s for unknown match', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/matches/nope/events',
      payload: tossPayload,
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /matches/:id/events returns the full event log in order', async () => {
    const { matchId } = await startMatch()
    await app.inject({ method: 'POST', url: `/matches/${matchId}/events`, payload: ballPayload(0, 0, 2) })
    const res = await app.inject({ method: 'GET', url: `/matches/${matchId}/events` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { events: { seq: number; type: string }[] }
    expect(body.events.map((e) => e.seq)).toEqual([1, 2])
    expect(body.events[0]?.type).toBe('TOSS')
    expect(body.events[1]?.type).toBe('BALL')
  })

  it('GET /matches/:id/scorecard returns batting and bowling cards', async () => {
    const { matchId } = await startMatch()
    await app.inject({ method: 'POST', url: `/matches/${matchId}/events`, payload: ballPayload(0, 0, 4) })
    const res = await app.inject({ method: 'GET', url: `/matches/${matchId}/scorecard` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      innings: { runs: number; batting: { playerId: string; runs: number }[] }[]
    }
    expect(body.innings[0]?.runs).toBe(4)
    expect(body.innings[0]?.batting[0]).toMatchObject({ playerId: 'a1', runs: 4 })
  })

  it('GET /matches/:id/stream sends an initial live event and updates after each ball', async () => {
    const { matchId } = await startMatch()
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address()
    if (address === null || typeof address === 'string') throw new Error('no address')
    const res = await fetch(`http://127.0.0.1:${address.port}/matches/${matchId}/stream`)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    async function readUntil(pred: (s: string) => boolean, timeoutMs = 5000): Promise<string> {
      const start = Date.now()
      let buf = ''
      while (Date.now() - start < timeoutMs) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        if (pred(buf)) return buf
      }
      throw new Error(`stream timeout, got: ${buf}`)
    }

    const initial = await readUntil((s) => s.includes('"runs":0'))
    expect(initial).toContain('event: live')
    await app.inject({ method: 'POST', url: `/matches/${matchId}/events`, payload: ballPayload(0, 0, 6) })
    const updated = await readUntil((s) => s.includes('"runs":6'))
    expect(updated).toContain('"runs":6')
    await reader.cancel()
  })
})

describe('players routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp(new MatchStore(openDb(':memory:')))
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /players requires a query string', async () => {
    const res = await app.inject({ method: 'GET', url: '/players' })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('INVALID_FORMAT')
  })

  it('GET /players searches by name prefix', async () => {
    await app.inject({
      method: 'POST',
      url: '/players',
      payload: { mobile: '9876543210', name: 'Rohit Sharma' },
    })
    await app.inject({
      method: 'POST',
      url: '/players',
      payload: { mobile: '9876543211', name: 'Virat Kohli' },
    })
    const res = await app.inject({ method: 'GET', url: '/players?q=Roh' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { players: { name: string }[] }
    expect(body.players.map((p) => p.name)).toEqual(['Rohit Sharma'])
  })

  it('POST /players validates required fields then creates (201) and exposes stats', async () => {
    const bad = await app.inject({ method: 'POST', url: '/players', payload: { name: 'No Mobile' } })
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as { code: string }).code).toBe('INVALID_PROFILE')

    const ok = await app.inject({
      method: 'POST',
      url: '/players',
      payload: { mobile: '9000000001', name: 'Suresh Raina' },
    })
    expect(ok.statusCode).toBe(201)
    const created = (ok.json() as { player: { id: string; name: string } }).player
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Suresh Raina')

    const stats = await app.inject({ method: 'GET', url: `/players/${created.id}/stats` })
    expect(stats.statusCode).toBe(200)
    expect((stats.json() as { matches: number }).matches).toBe(0)
  })

  it('GET /players/:id/stats 404s for unknown player', async () => {
    const res = await app.inject({ method: 'GET', url: '/players/p-nope/stats' })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { code: string }).code).toBe('NO_PLAYER')
  })
})
