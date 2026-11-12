import { describe, expect, it } from 'vitest'
import {
  calculateNRR,
  computeGroupStandings,
  effectiveOversForNRR,
  formatNRR,
  oversToDecimal,
} from './standings'

describe('standings/NRR', () => {
  it('converts cricket overs notation to decimal overs', () => {
    expect(oversToDecimal(19.4)).toBeCloseTo(19 + 4 / 6, 6)
    expect(oversToDecimal(20)).toBe(20)
    expect(oversToDecimal(0)).toBe(0)
  })

  it('uses full quota overs when all out', () => {
    expect(effectiveOversForNRR({ runs: 120, overs: 18.2, allOut: true }, 20)).toBe(20)
    expect(effectiveOversForNRR({ runs: 120, overs: 18.2, allOut: false }, 20)).toBeCloseTo(18 + 2 / 6, 6)
  })

  it('calculates NRR as run rate for minus against', () => {
    const nrr = calculateNRR({ runsScored: 200, oversFaced: 20, runsConceded: 180, oversBowled: 20 })
    expect(nrr).toBeCloseTo(1, 6)
  })

  it('computes standings with default points (W=2,T=1,NR=1,L=0)', () => {
    const teams = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]
    const results = [
      {
        teamAId: 'a', teamBId: 'b', result: 'A' as const, oversLimit: 20,
        teamA: { runs: 160, overs: 20 }, teamB: { runs: 150, overs: 20 },
      },
      {
        teamAId: 'a', teamBId: 'b', result: 'B' as const, oversLimit: 20,
        teamA: { runs: 140, overs: 20, allOut: true }, teamB: { runs: 141, overs: 18.4 },
      },
    ]
    const table = computeGroupStandings(teams, results)
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0]!.teamId).toBeDefined()
    const alpha = table.rows.find(r => r.teamId === 'a')!
    const beta = table.rows.find(r => r.teamId === 'b')!
    expect(alpha.played).toBe(2)
    expect(alpha.won).toBe(1)
    expect(alpha.lost).toBe(1)
    expect(alpha.points).toBe(2)
    expect(beta.points).toBe(2)
    // Alpha was all out in 2nd match: oversFaced should include full 20 for that innings
    expect(alpha.oversFaced).toBe(40)
  })

  it('handles NR (points, no NRR impact)', () => {
    const teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    const table = computeGroupStandings(teams, [
      { teamAId: 'a', teamBId: 'b', result: 'nr', teamA: null, teamB: null },
    ])
    const a = table.rows.find(r => r.teamId === 'a')!
    expect(a.played).toBe(1)
    expect(a.noResult).toBe(1)
    expect(a.points).toBe(1)
    expect(a.nrr).toBe(0)
  })

  it('handles tie (points, NRR counts)', () => {
    const teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    const table = computeGroupStandings(teams, [
      {
        teamAId: 'a', teamBId: 'b', result: 'tie', oversLimit: 20,
        teamA: { runs: 150, overs: 20 }, teamB: { runs: 150, overs: 20 },
      },
    ])
    const a = table.rows.find(r => r.teamId === 'a')!
    expect(a.tied).toBe(1)
    expect(a.points).toBe(1)
    expect(a.nrr).toBe(0)
  })

  it('sorts by points then NRR then name', () => {
    const teams = [
      { id: 'c', name: 'Charlie' },
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]
    const table = computeGroupStandings(teams, [
      { teamAId: 'a', teamBId: 'b', result: 'A', oversLimit: 20, teamA: { runs: 200, overs: 20 }, teamB: { runs: 100, overs: 20 } },
      { teamAId: 'c', teamBId: 'b', result: 'A', oversLimit: 20, teamA: { runs: 120, overs: 20 }, teamB: { runs: 119, overs: 20 } },
    ])
    expect(table.rows.map(r => r.teamId)).toEqual(['a', 'c', 'b'])
  })

  it('formats NRR with sign', () => {
    expect(formatNRR(1.234)).toBe('+1.234')
    expect(formatNRR(-0.5)).toBe('-0.500')
  })
})
