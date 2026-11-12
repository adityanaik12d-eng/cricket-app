import { describe, expect, it } from 'vitest'
import {
  celebrateDelivery,
  milestoneReached,
  nextMilestone,
} from './celebrate.js'

describe('nextMilestone', () => {
  it('returns 50 from a fresh innings', () => {
    expect(nextMilestone(0)).toBe(50)
  })

  it('returns the milestone just above the score', () => {
    expect(nextMilestone(49)).toBe(50)
    expect(nextMilestone(51)).toBe(100)
    expect(nextMilestone(99)).toBe(100)
  })

  it('is strictly greater than the score', () => {
    expect(nextMilestone(50)).toBe(100)
    expect(nextMilestone(100)).toBe(150)
  })

  it('falls back to 50 for a non-finite score', () => {
    expect(nextMilestone(Number.NaN)).toBe(50)
    expect(nextMilestone(Number.POSITIVE_INFINITY)).toBe(50)
  })

  it('never returns 0 for a negative score', () => {
    expect(nextMilestone(-10)).toBe(50)
  })
})

describe('milestoneReached', () => {
  it('reports the milestone the delivery crossed', () => {
    expect(milestoneReached(0, 50)).toBe(50)
    expect(milestoneReached(48, 54)).toBe(50)
  })

  it('reports the highest milestone crossed by a big jump', () => {
    expect(milestoneReached(49, 100)).toBe(100)
    expect(milestoneReached(0, 150)).toBe(150)
  })

  it('returns null when the score did not cross a milestone', () => {
    expect(milestoneReached(50, 54)).toBeNull()
    expect(milestoneReached(100, 101)).toBeNull()
    expect(milestoneReached(0, 49)).toBeNull()
  })

  it('never counts 0 as a milestone', () => {
    expect(milestoneReached(0, 0)).toBeNull()
    expect(milestoneReached(-5, 10)).toBeNull()
  })

  it('returns null for a non-finite score', () => {
    expect(milestoneReached(Number.NaN, 100)).toBeNull()
    expect(milestoneReached(10, Number.NaN)).toBeNull()
  })
})

describe('celebrateDelivery', () => {
  it('celebrates a wicket first', () => {
    const result = celebrateDelivery({ runs: 0, isWicket: true, wickets: 3, teamRuns: 20 })
    expect(result.kind).toBe('wicket')
    expect(result.label).toBe('WICKET!')
    expect(result.tier).toBe('big')
    expect(result.milestone).toBeNull()
    expect(result.runs).toBe(0)
    expect(result.wickets).toBe(3)
  })

  it('celebrates a six', () => {
    const result = celebrateDelivery({ runs: 6, isWicket: false, wickets: 0, teamRuns: 6 })
    expect(result.kind).toBe('six')
    expect(result.label).toBe('SIX!')
    expect(result.tier).toBe('big')
    expect(result.milestone).toBeNull()
  })

  it('celebrates a boundary', () => {
    const result = celebrateDelivery({ runs: 4, isWicket: false, wickets: 0, teamRuns: 4 })
    expect(result.kind).toBe('boundary')
    expect(result.label).toBe('FOUR!')
    expect(result.tier).toBe('small')
  })

  it('stays quiet for a single or a dot ball', () => {
    expect(celebrateDelivery({ runs: 1, isWicket: false, wickets: 0, teamRuns: 1 }).kind).toBe('none')
    expect(celebrateDelivery({ runs: 0, isWicket: false, wickets: 0, teamRuns: 0 }).kind).toBe('none')
    expect(celebrateDelivery({ runs: 1, isWicket: false, wickets: 0, teamRuns: 1 }).label).toBe('')
  })

  it('celebrates a milestone', () => {
    const result = celebrateDelivery({ runs: 2, isWicket: false, wickets: 0, teamRuns: 50 })
    expect(result.kind).toBe('milestone')
    expect(result.label).toBe('50 RUNS')
    expect(result.milestone).toBe(50)
    expect(result.tier).toBe('big')
  })

  it('keeps the milestone when the delivery is also a six', () => {
    const result = celebrateDelivery({ runs: 6, isWicket: false, wickets: 0, teamRuns: 54 })
    expect(result.kind).toBe('six')
    expect(result.label).toBe('SIX!')
    expect(result.milestone).toBe(50)
  })

  it('prefers the milestone over the boundary', () => {
    const result = celebrateDelivery({ runs: 4, isWicket: false, wickets: 0, teamRuns: 50 })
    expect(result.kind).toBe('milestone')
    expect(result.milestone).toBe(50)
  })

  it('prefers the wicket over the milestone', () => {
    const result = celebrateDelivery({ runs: 1, isWicket: true, wickets: 2, teamRuns: 100 })
    expect(result.kind).toBe('wicket')
    expect(result.label).toBe('WICKET!')
    expect(result.milestone).toBe(100)
  })

  it('goes huge on a hundred', () => {
    const result = celebrateDelivery({ runs: 1, isWicket: false, wickets: 0, teamRuns: 100 })
    expect(result.kind).toBe('milestone')
    expect(result.label).toBe('100 RUNS')
    expect(result.tier).toBe('huge')
  })

  it('goes huge on a six that carries the team past a hundred', () => {
    const result = celebrateDelivery({ runs: 6, isWicket: false, wickets: 0, teamRuns: 104 })
    expect(result.kind).toBe('six')
    expect(result.milestone).toBe(100)
    expect(result.tier).toBe('huge')
  })
})

describe('celebrateDelivery with extras', () => {
  it('reads the milestone from the total runs the delivery added', () => {
    const result = celebrateDelivery({
      runs: 0,
      totalRuns: 1,
      isWicket: false,
      wickets: 0,
      teamRuns: 50,
    })
    expect(result.kind).toBe('milestone')
    expect(result.milestone).toBe(50)
    expect(result.label).toBe('50 RUNS')
  })

  it('keeps the boundary when the delivery also carried an extra', () => {
    const result = celebrateDelivery({
      runs: 4,
      totalRuns: 5,
      isWicket: false,
      wickets: 0,
      teamRuns: 5,
    })
    expect(result.kind).toBe('boundary')
    expect(result.label).toBe('FOUR!')
  })

  it('falls back to the runs off the bat when no total is given', () => {
    const result = celebrateDelivery({ runs: 4, isWicket: false, wickets: 0, teamRuns: 4 })
    expect(result.kind).toBe('boundary')
  })
})
