import type { BattingCardLine, BowlingCardLine, Dismissal, Extra, InningsCard, LiveScore, MatchConfig, MatchResult } from '@cricket-app/core'

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
  fielderId?: string
}

export interface BuildBallInput {
  kind: BallKind
  runs: number
  dismissal?: Dismissal
  positions: PadPositions
  over: number
  ball: number
  fielderId?: string
}

/** Resolves a player id to a display name, falling back to the raw id for old matches. */
export function playerName(config: MatchConfig, id: string): string {
  return config.playerRefs?.[id]?.name ?? id
}

const FIELDERS_REQUIRED: ReadonlySet<Dismissal> = new Set(['CAUGHT', 'STUMPED', 'RUN_OUT', 'OBSTRUCTING'])

/** Dismissals credited to a fielder; the scorer must pick who. The rest are bowler/umpire decisions. */
export function requiresFielder(dismissal: Dismissal): boolean {
  return FIELDERS_REQUIRED.has(dismissal)
}

export interface ExtraOption {
  label: string
  kind: BallKind
  runs: number
}

/** The four extras a delivery can carry; each one opens a sheet of run variants. */
export type ExtraKind = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE'

export interface ExtraGroup {
  kind: ExtraKind
  label: string
  options: readonly ExtraOption[]
}

const runsOn = (kind: ExtraKind, prefix: string, counts: number[]): ExtraOption[] =>
  counts.map((runs) => ({ label: `${prefix}${runs}`, kind, runs }))

/**
 * The extras pad: each option carries the runs scored *on top of* the mandatory
 * penalty (a wide or no-ball adds its extra regardless). So `WD+4` is five
 * wides (the boundary case) and `NB+6` is a no-ball plus six off the bat.
 */
export const EXTRA_GROUPS: readonly ExtraGroup[] = [
  { kind: 'WIDE', label: 'Wide', options: runsOn('WIDE', 'WD+', [0, 1, 2, 3, 4]) },
  { kind: 'NO_BALL', label: 'No ball', options: runsOn('NO_BALL', 'NB+', [0, 1, 2, 3, 4, 6]) },
  { kind: 'BYE', label: 'Bye', options: runsOn('BYE', 'B+', [1, 2, 3, 4]) },
  { kind: 'LEG_BYE', label: 'Leg bye', options: runsOn('LEG_BYE', 'LB+', [1, 2, 3, 4]) },
]

/** The run variants behind one extras button — i.e. the sheet's contents. */
export function extrasForGroup(kind: ExtraKind): ExtraGroup {
  const group = EXTRA_GROUPS.find((g) => g.kind === kind)
  if (!group) throw new Error(`unknown extras group: ${kind}`)
  return group
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
    ...(input.fielderId ? { fielderId: input.fielderId } : {}),
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

/** The headline result line, or null while the match is still going. */
export function resultText(result: MatchResult | null): string | null {
  if (!result) return null
  if (result.kind === 'WINNER') return formatWin(result)
  if (result.kind === 'TIE') return 'Match tied'
  return `Match abandoned${result.reason ? `: ${result.reason}` : ''}`
}

/** The innings' best batter; ties break on strike rate, then on fewer balls. */
export function topScorer(inn: InningsCard): BattingCardLine | null {
  const played = inn.batting.filter((b) => b.balls > 0 || b.out)
  const first = played[0]
  if (!first) return null
  return played.reduce((best, b) => {
    if (b.runs !== best.runs) return b.runs > best.runs ? b : best
    const rate = b.balls > 0 ? b.runs / b.balls : 0
    const bestRate = best.balls > 0 ? best.runs / best.balls : 0
    if (rate !== bestRate) return rate > bestRate ? b : best
    return b.balls < best.balls ? b : best
  }, first)
}

/** The innings' leading wicket-taker; ties break on the lower economy. */
export function topBowler(inn: InningsCard): BowlingCardLine | null {
  const first = inn.bowling[0]
  if (!first) return null
  return inn.bowling.reduce((best, b) => {
    if (b.wickets !== best.wickets) return b.wickets > best.wickets ? b : best
    return b.economy < best.economy ? b : best
  }, first)
}

/** "Australia need 42 off 24" while a chase is live, else null. */
export function requirementText(live: LiveScore): string | null {
  if (live.status !== 'IN_PROGRESS' || live.target == null || live.battingTeamId == null) return null
  const need = Math.max(0, live.target - live.runs)
  if (need === 0) return null
  return `${live.battingTeamId} need ${need} off ${live.ballsRemaining}`
}
