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
  it('honours an explicit light preference even on a dark OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('honours an explicit dark preference even on a light OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the OS when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })

  it('is a closed 3-cycle', () => {
    expect(nextTheme(nextTheme(nextTheme('system')))).toBe('system')
  })
})

describe('THEME_LABEL', () => {
  it('labels every theme', () => {
    expect(Object.keys(THEME_LABEL).sort()).toEqual(['dark', 'light', 'system'])
  })
})

describe('DOM / storage guards (node environment)', () => {
  it('never throws when there is no browser', () => {
    expect(() => applyTheme('dark')).not.toThrow()
    expect(() => applyTheme('system')).not.toThrow()
    expect(() => storeTheme('light')).not.toThrow()
    expect(() => initTheme()).not.toThrow()
  })

  it('defaults to system without storage', () => {
    expect(readStoredTheme()).toBe('system')
  })
})
