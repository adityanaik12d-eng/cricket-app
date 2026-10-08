import { describe, expect, it } from 'vitest'
import { ballsToOvers, formatOvers, oversToBalls, round2 } from './overs.js'

describe('oversToBalls', () => {
  it('converts whole overs', () => {
    expect(oversToBalls(20, 6)).toBe(120)
    expect(oversToBalls(1, 6)).toBe(6)
  })

  it('converts fractional overs', () => {
    expect(oversToBalls(4.5, 6)).toBe(27)
    expect(oversToBalls(4.4, 6)).toBe(26)
  })

  it('converts five-ball over cricket', () => {
    expect(oversToBalls(20, 5)).toBe(100)
  })
})

describe('ballsToOvers', () => {
  it('round-trips every legal ball count', () => {
    for (let balls = 0; balls <= 120; balls += 1) {
      expect(oversToBalls(ballsToOvers(balls, 6), 6)).toBe(balls)
    }
  })

  it('reports cricket overs as whole.over.ball', () => {
    expect(ballsToOvers(0, 6)).toBe(0)
    expect(ballsToOvers(6, 6)).toBe(1)
    expect(ballsToOvers(27, 6)).toBe(4.5)
  })
})

describe('formatOvers', () => {
  it('formats whole overs without decimal', () => {
    expect(formatOvers(0, 6)).toBe('0')
    expect(formatOvers(6, 6)).toBe('1')
    expect(formatOvers(120, 6)).toBe('20')
  })

  it('formats partial overs', () => {
    expect(formatOvers(29, 6)).toBe('4.5') // 29 balls = 4*6 + 5, so 4.5
  })
})

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(8.3333333)).toBe(8.33)
    expect(round2(1 / 3)).toBe(0.33)
    expect(round2(0.125)).toBe(0.13)
  })
})