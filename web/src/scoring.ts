import type { Dismissal, Extra, LiveScore, MatchResult } from '@cricket-app/core'

export interface PadPositions {
  strikerId: string
  nonStrikerId: string
  bowlerId: string
}

export type BallKind = 'RUNS' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'WICKET'

export interface BallPayloadBody {
  type: 'BALL'
  over: number
  ball: number
  runs: number
  extras: Extra
  wicket: boolean
  dismissal: Dismissal | null
  dismissedPlayerId: string | null
  batterId: string
  nonStrikerId: string | null
  bowlerId: string
  fieldingCaptainId: string
}

export interface BuildBallInput {
  kind: BallKind
  runs: number
  dismissal?: Dismissal
  positions: PadPositions
  over: number
  ball: number
}

/** "20" -> {20,0}; "4.5" -> {4,5} (matches the engine's oversText format). */
export function parseOvers(oversText: string): { over: number; ball: number } {
  const dot = oversText.indexOf('.')
  if (dot === -1) return { over: Number(oversText) || 0, ball: 0 }
  return { over: Number(oversText.slice(0, dot)) || 0, ball: Number(oversText.slice(dot + 1)) || 0 }
}

/**
 * The engine only knows positions once the first ball of an innings has been
 * recorded; before that the scorer picks the openers. Between overs the bowler
 * is null while the batters are set, so each position falls back independently.
 */
export function resolvePositions(live: LiveScore, overrides: PadPositions): PadPositions {
  return {
    strikerId: live.striker?.playerId ?? overrides.strikerId,
    nonStrikerId: live.nonStriker?.playerId ?? overrides.nonStrikerId,
    bowlerId: live.bowler?.playerId ?? overrides.bowlerId,
  }
}

export function buildBallPayload(input: BuildBallInput): BallPayloadBody {
  const { kind, runs, positions, over, ball } = input
  if (kind === 'WICKET' && !input.dismissal) {
    throw new Error('dismissal required for a wicket')
  }
  const extras: Extra =
    kind === 'WIDE' ? 'WIDE'
    : kind === 'NO_BALL' ? 'NO_BALL'
    : kind === 'BYE' ? 'BYE'
    : kind === 'LEG_BYE' ? 'LEG_BYE'
    : 'NONE'
  return {
    type: 'BALL',
    over,
    ball,
    runs,
    extras,
    wicket: kind === 'WICKET',
    dismissal: kind === 'WICKET' ? (input.dismissal ?? null) : null,
    dismissedPlayerId: kind === 'WICKET' ? positions.strikerId : null,
    batterId: positions.strikerId,
    nonStrikerId: positions.nonStrikerId,
    bowlerId: positions.bowlerId,
    fieldingCaptainId: positions.bowlerId,
  }
}

/** "australia won by 10 wickets" — 'by' arrives as WICKETS/RUNS and is already plural. */
export function formatWin(result: MatchResult & { kind: 'WINNER' }): string {
  const noun = result.by === 'WICKETS'
    ? result.amount === 1 ? 'wicket' : 'wickets'
    : result.amount === 1 ? 'run' : 'runs'
  return `${result.teamId} won by ${result.amount} ${noun}`
}

/** "0.1-4-0" — whole.ballsInOver format, no float rounding (toFixed(1) shows 0.1 as 0.2). */
export function formatBowlerFigures(balls: number, runs: number, wickets: number): string {
  const over = Math.floor(balls / 6)
  const inOver = balls % 6
  return `${over}.${inOver}-${runs}-${wickets}`
}
