import { describe, expect, it } from 'vitest'
import { claimScoringControl, resolveScorerStatus } from './scorerControl'
import type { ScorerControlApi } from './scorerControl'
import type { TokenStore } from './ownership'

const LEGACY_STORE_KEY = 'cricket.myMatches'
const TOKEN_STORE_KEY = 'cricket.scorerTokens'

function fakeStore(seed: Record<string, string> = {}): TokenStore & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed }
  return {
    data,
    getItem: (key: string) => (key in data ? (data[key] ?? null) : null),
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  }
}

interface FakeApi extends ScorerControlApi {
  claims: Array<{ matchId: string; token: string }>
  reads: string[]
}

function fakeApi(options: {
  hash?: string | null
  claimSucceeds?: boolean
} = {}): FakeApi {
  const { hash = null, claimSucceeds = true } = options
  return {
    claims: [],
    reads: [],
    async claimScoring(matchId: string, token: string): Promise<boolean> {
      this.claims.push({ matchId, token })
      return claimSucceeds
    },
    async readScorerHash(matchId: string): Promise<string | null> {
      this.reads.push(matchId)
      return hash
    },
    async readMatchOwner(_matchId: string): Promise<string | null> {
      return null
    },
  }
}

/** The sha256 of a token, computed the same way the app does. */
async function digest(token: string): Promise<string> {
  const { hashScorerToken } = await import('./ownership')
  return hashScorerToken(token)
}

describe('resolveScorerStatus', () => {
  it('refuses a browser that never owned the match and never asks the database', async () => {
    const api = fakeApi()
    const status = await resolveScorerStatus('m1', { api, store: fakeStore() })
    expect(status.canScore).toBe(false)
    expect(status.reason).toBe('watcher')
    expect(api.reads).toEqual([])
    expect(api.claims).toEqual([])
  })

  it('accepts the owner when the stored hash matches the local token', async () => {
    const token = 'a'.repeat(32)
    const store = fakeStore({ [TOKEN_STORE_KEY]: JSON.stringify({ m1: token }) })
    const api = fakeApi({ hash: await digest(token) })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(true)
    expect(status.reason).toBe('owned')
  })

  it('refuses the owner when another device holds the match', async () => {
    const store = fakeStore({ [TOKEN_STORE_KEY]: JSON.stringify({ m1: 'a'.repeat(32) }) })
    const api = fakeApi({ hash: await digest('b'.repeat(32)) })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(false)
    expect(status.reason).toBe('other-device')
  })

  it('claims an unclaimed match for the owner that holds a token', async () => {
    const store = fakeStore({ [TOKEN_STORE_KEY]: JSON.stringify({ m1: 'a'.repeat(32) }) })
    const api = fakeApi({ hash: null })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(true)
    expect(status.reason).toBe('owned')
  })

  it('claims an unclaimed match for the legacy owner', async () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: JSON.stringify(['m1']) })
    const api = fakeApi({ hash: null })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(true)
    expect(status.reason).toBe('owned')
    expect(api.claims).toHaveLength(1)
    expect(api.claims[0]?.matchId).toBe('m1')
    expect(api.claims[0]?.token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('keeps the legacy owner in control when the claim fails', async () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: JSON.stringify(['m1']) })
    const api = fakeApi({ hash: null, claimSucceeds: false })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(true)
    expect(status.reason).toBe('legacy')
  })

  it('refuses the legacy owner when another device already claimed the match', async () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: JSON.stringify(['m1']) })
    const api = fakeApi({ hash: await digest('c'.repeat(32)) })
    const status = await resolveScorerStatus('m1', { api, store })
    expect(status.canScore).toBe(false)
    expect(status.reason).toBe('other-device')
    expect(api.claims).toEqual([])
  })
})

describe('claimScoringControl', () => {
  it('stores a fresh token and pushes it to the database', async () => {
    const store = fakeStore()
    const api = fakeApi()
    const token = await claimScoringControl('m1', { api, store })
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(store.data[TOKEN_STORE_KEY]).toContain('m1')
    expect(api.claims).toEqual([{ matchId: 'm1', token }])
  })

  it('keeps the token it already has', async () => {
    const store = fakeStore({ [TOKEN_STORE_KEY]: JSON.stringify({ m1: 'keep-me' }) })
    const api = fakeApi()
    const token = await claimScoringControl('m1', { api, store })
    expect(token).toBe('keep-me')
    expect(api.claims).toEqual([{ matchId: 'm1', token: 'keep-me' }])
  })
})
