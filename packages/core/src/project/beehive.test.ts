import { describe, expect, it } from 'vitest'
import {
  BEEHIVE_RADIUS,
  beehiveLattice,
  beehiveTone,
  groundToCell,
  hexCenter,
  projectBeehive,
} from './beehive.js'
import { withDefaults } from '../config.js'
import type { BallEvent, CorrectionEvent, MatchConfig } from '../types.js'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: {
    A: ['a1', 'a2', 'a3'],
    B: ['b1', 'b2', 'b3'],
  },
  playerRefs: {
    a1: { name: 'Kohli' },
    a2: { name: 'Rohit' },
    b1: { name: 'Bumrah' },
  },
})

let seq = 0
function base(): Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'> {
  return {
    over: 0,
    ball: 0,
    runs: 0,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
  }
}
function ball(p: Partial<BallEvent> = {}): BallEvent {
  seq += 1
  return { id: `e${seq}`, matchId: 'm1', seq, ts: '2026-10-08T10:00:00.000Z', type: 'BALL', ...base(), ...p }
}
function correction(supersedes: string, patch: Partial<BallEvent>): CorrectionEvent {
  seq += 1
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:05:00.000Z',
    type: 'CORRECTION',
    supersedes,
    replacement: { kind: 'BALL', ball: { ...base(), ...patch } },
    reason: 'fix',
  }
}

/** The circumradius of one hex cell: the ground radius split into rings. */
const HEX_R = BEEHIVE_RADIUS / 4

describe('hexCenter', () => {
  it('puts the first cell at the centre of the ground', () => {
    expect(hexCenter(0, 0, BEEHIVE_RADIUS)).toEqual({ x: 0, y: 0 })
  })

  it('spaces neighbouring cells by the width of a hex', () => {
    const a = hexCenter(0, 0, BEEHIVE_RADIUS)
    const b = hexCenter(1, 0, BEEHIVE_RADIUS)
    expect(Math.abs(b.x - a.x)).toBeCloseTo(Math.sqrt(3) * HEX_R, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('offsets every other row by half a cell', () => {
    const a = hexCenter(0, 0, BEEHIVE_RADIUS)
    const b = hexCenter(0, 1, BEEHIVE_RADIUS)
    expect(b.y).toBeCloseTo(1.5 * HEX_R, 6)
    expect(b.x).toBeCloseTo((Math.sqrt(3) / 2) * HEX_R, 6)
    expect(a.x).toBeCloseTo(0, 6)
  })

  it('scales with the ground radius', () => {
    const small = hexCenter(2, 1, 50)
    const big = hexCenter(2, 1, 100)
    expect(big.x).toBeCloseTo(small.x * 2, 6)
    expect(big.y).toBeCloseTo(small.y * 2, 6)
  })
})

describe('groundToCell', () => {
  it('maps the middle of the ground to the centre cell', () => {
    expect(groundToCell(0, 0, BEEHIVE_RADIUS)).toEqual({ col: 0, row: 0 })
  })

  it('maps a cell centre back to that cell', () => {
    for (const [col, row] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [-1, 0],
      [0, -1],
      [2, 0],
      [0, 2],
      [1, 2],
      [-2, 1],
    ]) {
      const centre = hexCenter(col, row, BEEHIVE_RADIUS)
      const angle = (Math.atan2(centre.x, -centre.y) * 180) / Math.PI
      const distance = Math.hypot(centre.x, centre.y) / BEEHIVE_RADIUS
      const cell = groundToCell(angle, distance, BEEHIVE_RADIUS)
      expect({ col: cell.col, row: cell.row }).toEqual({ col, row })
    }
  })

  it('never returns a cell further away than one hex radius', () => {
    for (const angle of [0, 37, 90, 143, 180, 221, 270, 321]) {
      for (const distance of [0, 0.15, 0.4, 0.65, 0.9, 1]) {
        const cell = groundToCell(angle, distance, BEEHIVE_RADIUS)
        const centre = hexCenter(cell.col, cell.row, BEEHIVE_RADIUS)
        const rad = (angle * Math.PI) / 180
        const r = distance * BEEHIVE_RADIUS
        const x = Math.sin(rad) * r
        const y = -Math.cos(rad) * r
        expect(Math.hypot(x - centre.x, y - centre.y)).toBeLessThanOrEqual(HEX_R + 1e-9)
      }
    }
  })
})

describe('beehiveLattice', () => {
  it('covers the ground with a ring of cells', () => {
    const cells = beehiveLattice(BEEHIVE_RADIUS)
    expect(cells.length).toBeGreaterThan(10)
  })

  it('starts at the centre of the ground', () => {
    const cells = beehiveLattice(BEEHIVE_RADIUS)
    expect(cells.some((c) => c.col === 0 && c.row === 0)).toBe(true)
  })

  it('keeps every cell within reach of the ground', () => {
    for (const cell of beehiveLattice(BEEHIVE_RADIUS)) {
      const centre = hexCenter(cell.col, cell.row, BEEHIVE_RADIUS)
      expect(Math.hypot(centre.x, centre.y)).toBeLessThanOrEqual(BEEHIVE_RADIUS + HEX_R)
    }
  })

  it('covers more of a bigger ground', () => {
    expect(beehiveLattice(50).length).toBeLessThan(beehiveLattice(100).length)
  })

  it('lists every cell once', () => {
    const cells = beehiveLattice(BEEHIVE_RADIUS)
    const keys = new Set(cells.map((c) => `${c.col}:${c.row}`))
    expect(keys.size).toBe(cells.length)
  })
})

describe('beehiveTone', () => {
  it('grades the density of a cell', () => {
    expect(beehiveTone(0)).toBe('none')
    expect(beehiveTone(1)).toBe('low')
    expect(beehiveTone(3)).toBe('low')
    expect(beehiveTone(4)).toBe('mid')
    expect(beehiveTone(8)).toBe('mid')
    expect(beehiveTone(9)).toBe('high')
  })
})

describe('projectBeehive', () => {
  it('returns nothing for an empty log', () => {
    expect(projectBeehive([])).toEqual([])
  })

  it('ignores deliveries without a recorded placement', () => {
    expect(projectBeehive([ball(), ball({ ball: 1 })])).toEqual([])
  })

  it('buckets a delivery into the cell it was hit into', () => {
    const cells = projectBeehive([ball({ shotAngle: 0, shotDistance: 0.2 })])
    expect(cells).toHaveLength(1)
    const cell = cells[0]
    expect(cell).toBeDefined()
    expect(cell?.col).toBe(0)
    expect(cell?.row).toBe(0)
  })

  it('counts the balls, runs, fours and sixes of a cell', () => {
    const cells = projectBeehive([
      ball({ shotAngle: 0, shotDistance: 0.2, runs: 4 }),
      ball({ ball: 1, shotAngle: 5, shotDistance: 0.21, runs: 1 }),
      ball({ ball: 2, shotAngle: 4, shotDistance: 0.2, runs: 6 }),
    ])
    expect(cells).toHaveLength(1)
    expect(cells[0]?.balls).toBe(3)
    expect(cells[0]?.runs).toBe(11)
    expect(cells[0]?.fours).toBe(1)
    expect(cells[0]?.sixes).toBe(1)
  })

  it('keeps separate cells apart', () => {
    const cells = projectBeehive([
      ball({ shotAngle: 0, shotDistance: 0.9 }),
      ball({ ball: 1, shotAngle: 180, shotDistance: 0.9 }),
    ])
    expect(cells).toHaveLength(2)
    expect(cells[0]?.row).not.toBe(cells[1]?.row)
  })

  it('honours corrections instead of counting the superseded delivery twice', () => {
    const original = ball({ shotAngle: 0, shotDistance: 0.2, runs: 1 })
    const cells = projectBeehive([original, correction(original.id, { shotAngle: 0, shotDistance: 0.2, runs: 4 })])
    expect(cells).toHaveLength(1)
    expect(cells[0]?.balls).toBe(1)
    expect(cells[0]?.runs).toBe(4)
  })

  it('treats a delivery without a distance as hit to the boundary', () => {
    const atBoundary = projectBeehive([ball({ shotAngle: 90, shotDistance: 1 })])
    const withoutDistance = projectBeehive([ball({ shotAngle: 90 })])
    expect(withoutDistance).toHaveLength(1)
    expect(withoutDistance[0]?.col).toBe(atBoundary[0]?.col)
    expect(withoutDistance[0]?.row).toBe(atBoundary[0]?.row)
  })
})
