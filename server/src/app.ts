import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { EngineError, projectLiveScore, projectResult, projectScorecard } from '@cricket-app/core'
import type { LiveScore } from '@cricket-app/core'
import { ApiError, MatchStore } from './store.ts'
import { openDb } from './db.ts'

export async function buildApp(store: MatchStore = new MatchStore(openDb(':memory:'))): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

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
