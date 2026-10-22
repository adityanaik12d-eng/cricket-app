import { describe, expect, it } from 'vitest'
import {
  createScorerToken,
  hashScorerToken,
  isScorerMatch,
  legacyMatchIds,
  readScorerToken,
  sha256Hex,
  storeScorerToken,
  type TokenStore,
} from './ownership'

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

const TOKEN_STORE_KEY = 'cricket.scorerTokens'
const LEGACY_STORE_KEY = 'cricket.myMatches'

describe('createScorerToken', () => {
  it('returns 32 hex characters', () => {
    const token = createScorerToken()
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns a different token every time', () => {
    expect(createScorerToken()).not.toBe(createScorerToken())
  })

  it('uses the injected random source', () => {
    const token = createScorerToken(() => 0.5)
    expect(token).toBe('8'.repeat(32))
  })
})

describe('scorer token store', () => {
  it('stores and reads back a token', () => {
    const store = fakeStore()
    storeScorerToken('m1', 'abc', store)
    expect(readScorerToken('m1', store)).toBe('abc')
    expect(store.data[TOKEN_STORE_KEY]).toContain('m1')
  })

  it('returns null for a match that was never claimed', () => {
    expect(readScorerToken('nope', fakeStore())).toBeNull()
  })

  it('replaces the token of a re-claimed match', () => {
    const store = fakeStore()
    storeScorerToken('m1', 'first', store)
    storeScorerToken('m1', 'second', store)
    expect(readScorerToken('m1', store)).toBe('second')
  })

  it('never throws when the store is blocked', () => {
    const broken: TokenStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readScorerToken('m1', broken)).toBeNull()
    expect(() => storeScorerToken('m1', 'abc', broken)).not.toThrow()
  })
})

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('matches the known digest of "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('matches the known digest of the quick brown fox', () => {
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    )
  })

  it('digests non-ascii text as utf-8', () => {
    expect(sha256Hex('é')).toBe(sha256Hex('é'))
    expect(sha256Hex('é')).not.toBe(sha256Hex('e'))
  })
})

describe('hashScorerToken', () => {
  it('resolves to the same hex digest as sha256Hex', async () => {
    await expect(hashScorerToken('abc')).resolves.toBe(sha256Hex('abc'))
  })

  it('resolves to an empty string for an empty token', async () => {
    await expect(hashScorerToken('')).resolves.toBe('')
  })
})

describe('legacyMatchIds', () => {
  it('reads the ids created before tokens existed', () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: JSON.stringify(['a', 'b']) })
    expect(legacyMatchIds(store)).toEqual(['a', 'b'])
  })

  it('ignores a poisoned store', () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: 'not json' })
    expect(legacyMatchIds(store)).toEqual([])
  })

  it('never throws when the store is blocked', () => {
    const broken: TokenStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }
    expect(legacyMatchIds(broken)).toEqual([])
  })
})

describe('isScorerMatch', () => {
  it('is false for a match this browser has never seen', () => {
    expect(isScorerMatch('m1', fakeStore())).toBe(false)
  })

  it('is true once a token is stored', () => {
    const store = fakeStore()
    storeScorerToken('m1', 'abc', store)
    expect(isScorerMatch('m1', store)).toBe(true)
  })

  it('is true for a legacy match listed in myMatches', () => {
    const store = fakeStore({ [LEGACY_STORE_KEY]: JSON.stringify(['legacy-1']) })
    expect(isScorerMatch('legacy-1', store)).toBe(true)
    expect(isScorerMatch('other', store)).toBe(false)
  })

  it('never throws when the store is blocked', () => {
    const broken: TokenStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }
    expect(isScorerMatch('m1', broken)).toBe(false)
  })
})
