import { describe, expect, it } from 'vitest'
import { parseHash } from './routes'

describe('parseHash', () => {
  it('treats the empty hash and #/ as home', () => {
    expect(parseHash('')).toEqual({ name: 'home' })
    expect(parseHash('#/')).toEqual({ name: 'home' })
  })

  it('puts setup on #/new', () => {
    expect(parseHash('#/new')).toEqual({ name: 'setup' })
  })

  it('keeps #/match/<id> on the scoring tab (share links)', () => {
    expect(parseHash('#/match/abc')).toEqual({ name: 'match', matchId: 'abc', tab: 'scoring' })
  })

  it('opens the report tab from #/match/<id>/report', () => {
    expect(parseHash('#/match/abc/report')).toEqual({ name: 'match', matchId: 'abc', tab: 'report' })
  })

  it('keeps signin and profile', () => {
    expect(parseHash('#/signin')).toEqual({ name: 'signin' })
    expect(parseHash('#/profile')).toEqual({ name: 'profile' })
  })

  it('parses #/admin', () => {
    expect(parseHash('#/admin')).toEqual({ name: 'admin' })
  })

  it('falls back to home for unknown routes', () => {
    expect(parseHash('#/nonsense')).toEqual({ name: 'home' })
    expect(parseHash('#/match')).toEqual({ name: 'home' })
  })
})
