import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { EngineError, projectCommentary, projectLiveScore, projectResult, projectScorecard } from '@cricket-app/core'
import type { LiveScore } from '@cricket-app/core'
import { ApiError, MatchStore } from './store.ts'
import { openDb } from './db.ts'
import { OtpService, registerAuthRoutes } from './auth.ts'
import { PlayerRepo } from './players.ts'
import { computeCareerStats } from './stats.ts'

export interface AppDeps {
  db?: ReturnType<typeof openDb>
  otp?: OtpService
  secret?: string
}

export async function buildApp(
  store: MatchStore = new MatchStore(openDb(':memory:')),
  deps: AppDeps = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  const db = deps.db ?? openDb(':memory:')
  const otp = deps.otp ?? new OtpService(db)
  const secret = deps.secret ?? process.env.JWT_SECRET ?? 'dev-secret-change-me'
  const repo = new PlayerRepo(db)
  registerAuthRoutes(app, { db, otp, secret, repo })

  app.get('/players', async (req) => {
    const { q } = req.query as { q?: unknown }
    if (typeof q !== 'string') throw new ApiError(400, 'INVALID_FORMAT', 'q query parameter is required')
    return { players: repo.search(q) }
  })

  app.post('/players', async (req, reply) => {
    const body = (req.body ?? {}) as { mobile?: unknown; name?: unknown }
    if (typeof body.mobile !== 'string' || typeof body.name !== 'string') {
      throw new ApiError(400, 'INVALID_PROFILE', 'mobile and name are required')
    }
    const player = repo.create({ mobile: body.mobile, name: body.name })
    reply.status(201)
    return { player }
  })

  app.get('/players/:id/stats', async (req) => {
    const { id } = req.params as { id: string }
    if (!repo.get(id)) throw new ApiError(404, 'NO_PLAYER', `Player ${id} not found`)
    return computeCareerStats(store.all(), id)
  })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      reply.status(err.statusCode).send({ error: err.message, code: err.code })
      return
    }
    if (err instanceof EngineError) {
      reply.status(400).send({ error: err.message, code: err.code })
      return
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    reply.status(500).send({ error: message })
  })

  app.post('/matches', async (req, reply) => {
    const record = store.create(req.body)
    reply.status(201)
    return {
      matchId: record.matchId,
      state: record.state,
      live: projectLiveScore(record.state),
    }
  })

  app.get('/matches/:id', async (req) => {
    const { id } = req.params as { id: string }
    const record = store.mustGet(id)
    return {
      matchId: record.matchId,
      state: record.state,
      live: projectLiveScore(record.state),
      scorecard: projectScorecard(record.state),
      result: projectResult(record.state),
    }
  })

  app.get('/matches/:id/live', async (req) => {
    const { id } = req.params as { id: string }
    return projectLiveScore(store.mustGet(id).state)
  })

  app.get('/matches/:id/scorecard', async (req) => {
    const { id } = req.params as { id: string }
    return projectScorecard(store.mustGet(id).state)
  })

  app.get('/matches/:id/events', async (req) => {
    const { id } = req.params as { id: string }
    return { events: store.mustGet(id).events }
  })

  app.get('/matches/:id/commentary', async (req) => {
    const { id } = req.params as { id: string }
    const record = store.mustGet(id)
    return { commentary: projectCommentary(record.config, record.events) }
  })

  app.post('/matches/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { event, state, live } = store.append(id, req.body)
    reply.status(201)
    return { seq: event.seq, state, live }
  })

  app.get('/matches/:id/stream', async (req, reply) => {
    const { id } = req.params as { id: string }
    const record = store.mustGet(id)

    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const send = (live: LiveScore): void => {
      res.write(`event: live\ndata: ${JSON.stringify(live)}\n\n`)
    }

    send(projectLiveScore(record.state))

    const onUpdate = (matchId: string, update: { live: LiveScore }): void => {
      if (matchId === id) send(update.live)
    }
    store.on('update', onUpdate)
    req.raw.on('close', () => {
      store.off('update', onUpdate)
      res.end()
    })
  })

  return app
}
