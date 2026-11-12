import { describe, expect, it } from 'vitest'
import { calculateRevisedTarget, resourcePercent } from './dls'

describe('DLS (MVP)', () => {
  it('returns full resources at start of T20', () => {
    expect(resourcePercent(20, 20)).toBeGreaterThan(50)
  })

  it('reduces target when 2nd innings overs reduced (DLS MVP)', () => {
    const r = calculateRevisedTarget({ method: 'DLS_5_0', team1Runs: 180, totalOvers: 20, oversAvailableTeam2: 15 })
    expect(r.revisedOvers).toBe(15)
    expect(r.revisedTarget).toBeLessThan(181)
    expect(r.revisedTarget).toBeGreaterThan(0)
  })

  it('uses manual/VJD target', () => {
    const r = calculateRevisedTarget({ method: 'VJD', team1Runs: 180, totalOvers: 20, manualTarget: 145, oversAvailableTeam2: 15 })
    expect(r.revisedTarget).toBe(145)
    expect(r.revisedOvers).toBe(15)
  })
})
