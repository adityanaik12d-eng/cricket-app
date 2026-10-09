import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './db.ts'
import { PlayerRepo } from './players.ts'
import { ApiError } from './store.ts'

describe('PlayerRepo', () => {
  let db: DatabaseSync
  let repo: PlayerRepo

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new PlayerRepo(db)
  })

  it('creates a player and finds them by mobile', () => {
    const p = repo.create({ mobile: '9876543210', name: 'Virat K' })
    expect(p.id).toMatch(/^p-/)
    expect(repo.byMobile('9876543210')?.name).toBe('Virat K')
    expect(p.role).toBe('BATSMAN')
    expect(p.batting_hand).toBe('RHB')
  })

  it('rejects a duplicate mobile with 409 MOBILE_TAKEN', () => {
    repo.create({ mobile: '9876543210', name: 'A' })
    try {
      repo.create({ mobile: '9876543210', name: 'B' })
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).statusCode).toBe(409)
      expect((err as ApiError).code).toBe('MOBILE_TAKEN')
    }
  })

  it('rejects invalid input with 400 INVALID_PROFILE', () => {
    expect(() => repo.create({ mobile: '12345', name: 'X' })).toThrow(ApiError)
    expect(() => repo.create({ mobile: '9876543210', name: '' })).toThrow(ApiError)
    expect(() => repo.create({ mobile: '9876543211', name: 'Y', role: 'WIZARD' as never })).toThrow(ApiError)
  })

  it('searches by mobile prefix and by name prefix (case-insensitive)', () => {
    repo.create({ mobile: '9876543210', name: 'Virat K' })
    repo.create({ mobile: '9876500001', name: 'rohit s' })
    repo.create({ mobile: '9111111111', name: 'MSD' })

    expect(repo.search('987654').map((p) => p.name)).toEqual(['Virat K'])
    expect(repo.search('vir').map((p) => p.name)).toEqual(['Virat K'])
    expect(repo.search('ROH').map((p) => p.name)).toEqual(['rohit s'])
  })

  it('caps search results at 10 and treats wildcard chars literally', () => {
    for (let i = 0; i < 15; i++) {
      repo.create({ mobile: `98${String(i).padStart(8, '0')}`, name: `Player${i}` })
    }
    expect(repo.search('98')).toHaveLength(10)
    expect(repo.search('%')).toHaveLength(0)
    expect(repo.search('')).toHaveLength(0)
  })

  it('updates profile fields and validates enums', () => {
    const p = repo.create({ mobile: '9876543210', name: 'Ravi' })
    const upd = repo.update(p.id, {
      role: 'KEEPER',
      batting_hand: 'LHB',
      bowling_style: 'Left-arm fast',
      location: 'Pune',
    })
    expect(upd.role).toBe('KEEPER')
    expect(upd.batting_hand).toBe('LHB')
    expect(upd.bowling_style).toBe('Left-arm fast')

    expect(() => repo.update(p.id, { role: 'NOPE' as never })).toThrow(ApiError)
    expect(() => repo.update('p-missing', { name: 'X' })).toThrow(ApiError)
  })
})
