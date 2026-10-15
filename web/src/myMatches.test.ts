import { describe, expect, it } from 'vitest'
import { myMatchIds, rememberMatch } from './myMatches'
import type { MatchStore } from './myMatches'

function fakeStore(initial: Record<string, string> = {}, opts: { readThrows?: boolean; writeThrows?: boolean } = {}) {
  const data = new Map(Object.entries(initial))
  const store: MatchStore = {
    getItem: (key) => {
      if (opts.readThrows) throw new Error('blocked')
      return data.get(key) ?? null
    },
    setItem: (key, value) => {
      if (opts.writeThrows) throw new Error('quota')
      data.set(key, value)
    },
  }
  return { store, data }
}

describe('myMatches', () => {
  it('starts empty', () => {
    expect(myMatchIds(fakeStore().store)).toEqual([])
  })

  it('remembers a match', () => {
    const { store } = fakeStore()
    rememberMatch('m1', store)
    expect(myMatchIds(store)).toEqual(['m1'])
  })

  it('keeps the newest match first and does not duplicate', () => {
    const { store } = fakeStore()
    rememberMatch('m1', store)
    rememberMatch('m2', store)
    rememberMatch('m1', store)
    expect(myMatchIds(store)).toEqual(['m1', 'm2'])
  })

  it('caps the list at 50 ids', () => {
    const { store } = fakeStore()
    for (let i = 0; i < 60; i++) rememberMatch(`m${i}`, store)
    const ids = myMatchIds(store)
    expect(ids).toHaveLength(50)
    expect(ids[0]).toBe('m59')
  })

  it('ignores malformed storage contents', () => {
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': 'not json' }).store)).toEqual([])
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': '{"a":1}' }).store)).toEqual([])
    expect(myMatchIds(fakeStore({ 'cricket.myMatches': '[1,"m1",null]' }).store)).toEqual(['m1'])
  })

  it('survives a store that throws (review focus 3)', () => {
    expect(myMatchIds(fakeStore({}, { readThrows: true }).store)).toEqual([])
    expect(() => rememberMatch('m1', fakeStore({}, { writeThrows: true }).store)).not.toThrow()
  })
})