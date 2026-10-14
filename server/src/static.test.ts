import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.ts'
import { openDb } from './db.ts'
import { MatchStore } from './store.ts'

const INDEX = '<!doctype html><title>CRICKET_INDEX_MARKER</title>'
const APP_JS = 'console.log("CRICKET_JS_MARKER")'
const SECRET = 'CRICKET_SECRET_MARKER'

const lineups = {
  A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
}

describe('static serving and health endpoint', () => {
  let app: FastifyInstance
  let parent: string
  let root: string

  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'cricket-static-'))
    root = join(parent, 'dist')
    await mkdir(join(root, 'assets'), { recursive: true })
    await writeFile(join(root, 'index.html'), INDEX)
    await writeFile(join(root, 'assets', 'app.js'), APP_JS)
    await writeFile(join(parent, 'secret.txt'), SECRET)

    const db = openDb(':memory:')
    app = await buildApp(new MatchStore(db), { db, webRoot: root })
  })

  afterAll(async () => {
    await app.close()
    await rm(parent, { recursive: true, force: true })
  })

  it('exposes a health endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('serves index.html at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('CRICKET_INDEX_MARKER')
  })

  it('serves built assets with the right content type', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
    expect(res.body).toContain('CRICKET_JS_MARKER')
  })

  it('falls back to index.html for unknown extensionless paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/some/deep/link' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('CRICKET_INDEX_MARKER')
  })

  it('returns 404 for a missing file that has an extension', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/missing.js' })
    expect(res.statusCode).toBe(404)
  })

  it('does not allow path traversal outside the web root', async () => {
    const res = await app.inject({ method: 'GET', url: '/%2e%2e/secret.txt' })
    expect(res.body).not.toContain('CRICKET_SECRET_MARKER')
  })

  it('still serves the API when static hosting is enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload: { teamAId: 'teamA', teamBId: 'teamB', lineups, oversPerInnings: 2, powerplayOvers: 2 },
    })
    expect(res.statusCode).toBe(201)
  })
})
