import { describe, expect, it } from 'vitest'
import {
  THEME_LABEL,
  applyTheme,
  initTheme,
  nextTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
} from './theme'

describe('resolveTheme', () => {
  it('honours an explicit paper preference even on a dark OS', () => {
    expect(resolveTheme('paper', true)).toBe('paper')
  })

  it('honours an explicit floodlight preference even on a light OS', () => {
    expect(resolveTheme('floodlight', false)).toBe('floodlight')
  })

  it('follows the OS when the preference is auto', () => {
    expect(resolveTheme('auto', true)).toBe('floodlight')
    expect(resolveTheme('auto', false)).toBe('paper')
  })
})

describe('nextTheme', () => {
  it('cycles paper → floodlight → auto → paper', () => {
    expect(nextTheme('paper')).toBe('floodlight')
    expect(nextTheme('floodlight')).toBe('auto')
    expect(nextTheme('auto')).toBe('paper')
  })

  it('is a closed 3-cycle', () => {
    expect(nextTheme(nextTheme(nextTheme('paper')))).toBe('paper')
  })
})

describe('THEME_LABEL', () => {
  it('labels every theme', () => {
    expect(Object.keys(THEME_LABEL).sort()).toEqual(['auto', 'floodlight', 'paper'])
  })
})

describe('DOM / storage guards (node environment)', () => {
  it('never throws when there is no browser', () => {
    expect(() => applyTheme('floodlight')).not.toThrow()
    expect(() => applyTheme('auto')).not.toThrow()
    expect(() => storeTheme('paper')).not.toThrow()
    expect(() => initTheme()).not.toThrow()
  })

  it('defaults to auto without storage', () => {
    expect(readStoredTheme()).toBe('auto')
  })
})