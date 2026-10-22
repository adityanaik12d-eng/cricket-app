import type { MatchEvent } from '../types.js'
import { effectiveEvents } from '../apply.js'
import { clampDistance, normalizeAngle, polarToXY } from './wagon.js'

/**
 * The beehive: where the scoring concentrated.
 *
 * The ground is covered by a pointy-top hex grid (odd-r offset coordinates) and
 * every delivery with a recorded shot placement is bucketed into the cell it
 * was hit into. The maths reuses the wagon wheel's polar projection, so a
 * placement means the same thing in both views: 0 degrees is straight down the
 * ground and the distance is a fraction of the ground radius.
 */

/** The radius of the ground the grid covers, in grid units. */
export const BEEHIVE_RADIUS = 100

/** How many hex cells fit between the middle of the ground and the boundary. */
export const BEEHIVE_HEX_RINGS = 4

/** One cell of the grid and what was hit into it. */
export interface BeehiveCell {
  col: number
  row: number
  /** How many deliveries landed in this cell. */
  balls: number
  /** The runs those deliveries scored. */
  runs: number
  fours: number
  sixes: number
}

/** The density of a cell, used to colour it. */
export type BeehiveTone = 'none' | 'low' | 'mid' | 'high'

/** The circumradius of one hex cell. */
export function hexRadius(radius: number): number {
  return radius / BEEHIVE_HEX_RINGS
}

/** Offset coordinates (odd-r) to axial coordinates. */
function toAxial(col: number, row: number): { q: number; r: number } {
  return { q: col - (row - (row & 1)) / 2, r: row }
}

/** Axial coordinates back to offset coordinates (odd-r). */
function toOffset(q: number, r: number): { col: number; row: number } {
  return { col: q + (r - (r & 1)) / 2, row: r }
}

/** Keeps a negative zero from leaking into cell keys and React keys. */
function noNegativeZero(value: number): number {
  return value + 0
}

/** The centre of one hex cell, in ground coordinates. */
export function hexCenter(col: number, row: number, radius: number): { x: number; y: number } {
  const size = hexRadius(radius)
  const { q, r } = toAxial(col, row)
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  }
}

/** Rounds fractional axial coordinates to the nearest hex cell. */
function cubeRound(qf: number, rf: number): { q: number; r: number } {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) {
    q = -r - s
  } else if (dr > ds) {
    r = -q - s
  }
  return { q: noNegativeZero(q), r: noNegativeZero(r) }
}

/** The cell of the grid a ground point falls into. */
export function groundToCell(
  angle: number,
  distance01: number,
  radius: number,
): { col: number; row: number } {
  const size = hexRadius(radius)
  const { x, y } = polarToXY(angle, distance01, radius)
  const qf = (Math.sqrt(3) / 3 * x - y / 3) / size
  const rf = (2 / 3 * y) / size
  const { q, r } = cubeRound(qf, rf)
  return toOffset(q, r)
}

/**
 * Buckets the deliveries of a match into the hex cells they were hit into.
 *
 * Only deliveries carrying a recorded placement are counted, so matches
 * recorded before placement existed simply produce no cells.
 */
export function projectBeehive(events: MatchEvent[]): BeehiveCell[] {
  const cells = new Map<string, BeehiveCell>()
  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue
    if (typeof event.shotAngle !== 'number' || !Number.isFinite(event.shotAngle)) continue
    const angle = normalizeAngle(event.shotAngle)
    const distance = clampDistance(typeof event.shotDistance === 'number' ? event.shotDistance : 1)
    const { col, row } = groundToCell(angle, distance, BEEHIVE_RADIUS)
    const key = `${col}:${row}`
    const cell = cells.get(key) ?? { col, row, balls: 0, runs: 0, fours: 0, sixes: 0 }
    cell.balls += 1
    cell.runs += event.runs
    if (event.runs === 4) cell.fours += 1
    if (event.runs >= 6) cell.sixes += 1
    cells.set(key, cell)
  }
  return [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col)
}

/** The density tier of a cell, used for its colour. */
export function beehiveTone(balls: number): BeehiveTone {
  if (!Number.isFinite(balls) || balls <= 0) return 'none'
  if (balls <= 3) return 'low'
  if (balls <= 8) return 'mid'
  return 'high'
}
