import { describe, expect, it } from 'vitest'
import { DEFAULT_MATCH_CONFIG, validateMatchConfig, withDefaults } from './config.js'
import type { MatchConfigInput } from './config.js'
import type { MatchConfig } from './types.js'

const base: MatchConfig = {
  matchId: 'm-1',
  teamAId: 'A-team',
  teamBId: 'B-team',
  lineups: {
    A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    B: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11'],
  },
  oversPerInnings: 20,
  inningsCount: 2,
  ballsPerOver: 6,
  maxOversPerBowler: 4,
  maxWickets: 10,
  powerplayOvers: 6,
  wideExtra: 1,
  noBallExtra: 1,
  minutesPerOver: 4,
}

function config(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return { ...base, ...overrides }
}

describe('DEFAULT_MATCH_CONFIG', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_MATCH_CONFIG.wideExtra).toBe(1)
    expect(DEFAULT_MATCH_CONFIG.noBallExtra).toBe(1)
    expect(DEFAULT_MATCH_CONFIG.minutesPerOver).toBe(4)
    expect(DEFAULT_MATCH_CONFIG.ballsPerOver).toBe(6)
    expect(DEFAULT_MATCH_CONFIG.maxWickets).toBe(10)
  })
})

describe('withDefaults', () => {
  it('fills defaults', () => {
    const result = withDefaults({
      matchId: 'm-1',
      teamAId: 'A-team',
      teamBId: 'B-team',
      lineups: base.lineups,
    })
    expect(result).toEqual(base)
  })

  it('withDefaults preserves playerRefs', () => {
    const playerRefs = { 'p-1': { name: 'Virat', mobile: '9876543210', verified: true } }
    const cfg = withDefaults({
      matchId: 'm1',
      teamAId: 'A',
      teamBId: 'B',
      lineups: {
        A: Array.from({ length: 11 }, (_, i) => `a${i + 1}`),
        B: Array.from({ length: 11 }, (_, i) => `b${i + 1}`),
      },
      playerRefs,
    } satisfies MatchConfigInput)
    expect(cfg.playerRefs).toEqual(playerRefs)
  })
})

describe('validateMatchConfig', () => {
  it('accepts valid config', () => {
    expect(validateMatchConfig(config())).toEqual({ ok: true })
  })

  it('rejects short lineup', () => {
    const result = validateMatchConfig(config({ lineups: { A: ['a1', 'a2'], B: base.lineups.B } }))
    expect(result.ok).toBe(false)
  })

  it('rejects quota uncoverable', () => {
    const result = validateMatchConfig(config({ maxOversPerBowler: 1 }))
    expect(result.ok).toBe(false)
  })

  it('rejects zero overs', () => {
    const result = validateMatchConfig(config({ oversPerInnings: 0 }))
    expect(result.ok).toBe(false)
  })

  it('rejects powerplay > overs', () => {
    const result = validateMatchConfig(config({ powerplayOvers: 25 }))
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate in same team', () => {
    const lineups = { A: [...base.lineups.A.slice(0, 10), 'a1'], B: base.lineups.B }
    const result = validateMatchConfig(config({ lineups }))
    expect(result.ok).toBe(false)
  })

  it('rejects same player in both teams', () => {
    const lineups = { A: ['a1', ...base.lineups.A.slice(1, 10), 'a2'], B: ['a2', ...base.lineups.B.slice(1)] }
    const result = validateMatchConfig(config({ lineups }))
    expect(result.ok).toBe(false)
  })

  it('rejects same team', () => {
    const result = validateMatchConfig(config({ teamBId: 'A-team' }))
    expect(result.ok).toBe(false)
  })
})