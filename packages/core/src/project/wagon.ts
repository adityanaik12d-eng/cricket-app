import { effectiveEvents } from '../apply.js'
import type { Extra, MatchEvent } from '../types.js'

/** A delivery that carries a recorded shot placement. */
export interface WagonShot {
  seq: number
  /** Zero-based over index the delivery was bowled in. */
  over: number
  /** Zero-based ball index within the over. */
  ball: number
  batterId: string
  runs: number
  extras: Extra
  /** Degrees clockwise from straight down the ground (0-360). */
  angle: number
  /** How far the ball travelled, as a fraction of the ground radius (0-1). */
  distance: number
  wicket: boolean
}

/** Filters applied when projecting the wagon wheel. */
export interface WagonFilter {
  /** Keep only shots hit by this batter. */
  batterId?: string
  /** Keep only shots worth one of these run counts. */
  runs?: number[]
}

/** The colour buckets a shot can fall into. */
export type WagonRunType = 'dot' | 'runs' | 'four' | 'six'

/** Run counts offered as wheel filters. */
export const WAGON_RUN_FILTERS = [1, 2, 3, 4, 6] as const

/** Wrap any angle into the 0-360 range. */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** Clamp a distance into the 0-1 range. */
export function clampDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  if (distance < 0) return 0
  if (distance > 1) return 1
  return distance
}

/**
 * Polar shot placement to SVG coordinates.
 * 0 degrees points straight up (down the ground); angles increase clockwise.
 */
export function polarToXY(angleDeg: number, distance01: number, radius: number): { x: number; y: number } {
  const rad = (normalizeAngle(angleDeg) * Math.PI) / 180
  const r = clampDistance(distance01) * radius
  return { x: Math.sin(rad) * r, y: -Math.cos(rad) * r }
}

/** Bucket a shot's runs for colouring. */
export function wagonRunType(runs: number): WagonRunType {
  if (runs >= 6) return 'six'
  if (runs === 4) return 'four'
  if (runs > 0) return 'runs'
  return 'dot'
}

/**
 * Project the delivery log into wagon-wheel shots.
 * Only deliveries carrying an optional shot placement are included, so matches
 * recorded before placement existed simply produce no shots.
 */
export function projectWagonWheel(events: MatchEvent[], filter: WagonFilter = {}): WagonShot[] {
  const runSet = filter.runs && filter.runs.length > 0 ? new Set(filter.runs) : null
  const shots: WagonShot[] = []
  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue
    if (typeof event.shotAngle !== 'number' || !Number.isFinite(event.shotAngle)) continue
    shots.push({
      seq: event.seq,
      over: event.over,
      ball: event.ball,
      batterId: event.batterId,
      runs: event.runs,
      extras: event.extras,
      angle: normalizeAngle(event.shotAngle),
      distance: clampDistance(typeof event.shotDistance === 'number' ? event.shotDistance : 1),
      wicket: event.wicket,
    })
  }
  return shots
    .filter((shot) => (filter.batterId ? shot.batterId === filter.batterId : true))
    .filter((shot) => (runSet ? runSet.has(shot.runs) : true))
    .sort((a, b) => a.seq - b.seq)
}

/** Totals used for the wheel summary and its accessible label. */
export function summariseWagon(shots: WagonShot[]): {
  shots: number
  runs: number
  fours: number
  sixes: number
} {
  let runs = 0
  let fours = 0
  let sixes = 0
  for (const shot of shots) {
    runs += shot.runs
    if (shot.runs === 4) fours += 1
    if (shot.runs >= 6) sixes += 1
  }
  return { shots: shots.length, runs, fours, sixes }
}
