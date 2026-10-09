import { describe, expect, it } from 'vitest'
import { buildLineupRefs, directoryEntry, newLocalEntry } from './lineup'
import type { Player } from './api'

const player: Player = {
  id: 'p-1',
  mobile: '9876543210',
  name: 'Virat K',
  role: 'BATSMAN',
  batting_hand: 'RHB',
  bowling_style: null,
  location: null,
  created_at: '2026-10-08T00:00:00.000Z',
}

describe('lineup', () => {
  it('newLocalEntry is unverified, carries the name, and gets a unique id', () => {
    const a = newLocalEntry('Rohit', [])
    const b = newLocalEntry('Rohit', [a.id])
    expect(a.verified).toBe(false)
    expect(a.name).toBe('Rohit')
    expect(a.mobile).toBeUndefined()
    expect(b.id).not.toBe(a.id)
    expect(a.id.startsWith('local-')).toBe(true)
  })

  it('newLocalEntry trims and rejects empty names', () => {
    expect(() => newLocalEntry('   ', [])).toThrow('name required')
  })

  it('directoryEntry links the mobile and marks verified', () => {
    const e = directoryEntry(player)
    expect(e).toEqual({ id: 'p-1', name: 'Virat K', mobile: '9876543210', verified: true })
  })

  it('buildLineupRefs returns ids plus a refs map for every entry', () => {
    const local = newLocalEntry('Rohit', [])
    const dir = directoryEntry(player)
    const { ids, refs } = buildLineupRefs([local, dir])
    expect(ids).toEqual([local.id, 'p-1'])
    expect(refs[local.id]).toEqual({ name: 'Rohit', verified: false })
    expect(refs['p-1']).toEqual({ name: 'Virat K', mobile: '9876543210', verified: true })
  })
})
