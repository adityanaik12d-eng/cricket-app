import { describe, expect, it } from 'vitest'
import { roleLabel, validateProfilePatch } from './profile'

describe('validateProfilePatch', () => {
  it('accepts a valid patch', () => {
    const res = validateProfilePatch({ role: 'KEEPER', batting_hand: 'LHB', location: 'Pune' })
    expect(res.ok).toBe(true)
  })

  it('rejects unknown roles and hands', () => {
    expect(validateProfilePatch({ role: 'WIZARD' as never })).toMatchObject({ ok: false })
    expect(validateProfilePatch({ batting_hand: 'MIDDLE' as never })).toMatchObject({ ok: false })
  })

  it('rejects empty name and whitespace-only location', () => {
    expect(validateProfilePatch({ name: '  ' })).toMatchObject({ ok: false })
    expect(validateProfilePatch({ location: '   ' })).toMatchObject({ ok: false })
  })

  it('allows empty patch and null clears', () => {
    expect(validateProfilePatch({}).ok).toBe(true)
    expect(validateProfilePatch({ bowling_style: null, location: null }).ok).toBe(true)
  })
})

describe('roleLabel', () => {
  it('renders readable role names', () => {
    expect(roleLabel('BATSMAN')).toBe('Batsman')
    expect(roleLabel('BOWLER')).toBe('Bowler')
    expect(roleLabel('KEEPER')).toBe('Wicketkeeper')
    expect(roleLabel('ALL_ROUNDER')).toBe('All-rounder')
  })
})
