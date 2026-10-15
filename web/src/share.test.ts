import { describe, expect, it } from 'vitest'
import { matchShareUrl } from './share'

describe('matchShareUrl', () => {
  it('builds a hash link for a match on the given origin', () => {
    expect(matchShareUrl('abc-123', 'https://cricket-scorer-gold.vercel.app')).toBe(
      'https://cricket-scorer-gold.vercel.app/#/match/abc-123',
    )
  })

  it('ignores a trailing slash on the origin', () => {
    expect(matchShareUrl('abc', 'https://example.com/')).toBe('https://example.com/#/match/abc')
  })

  it('keeps a sub-path origin (e.g. GitHub Pages project sites)', () => {
    expect(matchShareUrl('abc', 'https://user.github.io/cricket-app')).toBe(
      'https://user.github.io/cricket-app/#/match/abc',
    )
  })

  it('encodes the match id', () => {
    expect(matchShareUrl('a b', 'https://example.com')).toBe('https://example.com/#/match/a%20b')
  })
})
