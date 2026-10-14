export type Dismissal =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'OBSTRUCTING'

export type Extra = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE'

export type MatchStatus =
  | 'CREATED'
  | 'TOSS'
  | 'IN_PROGRESS'
  | 'INNINGS_BREAK'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'TIED'

export type TeamKey = 'A' | 'B'

export type Lineups = Record<TeamKey, string[]>

export interface PlayerRef {
  name: string
  mobile?: string
  verified?: boolean
}

export interface MatchConfig {
  matchId: string
  teamAId: string
  teamBId: string
  lineups: Lineups
  oversPerInnings: number
  inningsCount: number
  ballsPerOver: number
  maxOversPerBowler: number
  maxWickets: number
  powerplayOvers: number
  wideExtra: number
  noBallExtra: number
  minutesPerOver: number
  playerRefs?: Record<string, PlayerRef>
}

interface EventBase {
  id: string
  matchId: string
  seq: number
  ts: string
}

export interface BallEvent extends EventBase {
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

export interface TossEvent extends EventBase {
  type: 'TOSS'
  winnerTeamId: string
  winnerDecision: 'BAT' | 'BOWL'
}

export interface DeclareEvent extends EventBase {
  type: 'DECLARE'
}

export interface PenaltyEvent extends EventBase {
  type: 'PENALTY'
  runs: number
  teamId: string
}

export interface EndMatchEvent extends EventBase {
  type: 'END_MATCH'
  outcome: { kind: 'TIE' } | { kind: 'ABANDONED'; reason: string | null }
}

export type Replacement =
  | { kind: 'BALL'; ball: Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'> }
  | { kind: 'PENALTY'; penalty: Omit<PenaltyEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'> }

export interface CorrectionEvent extends EventBase {
  type: 'CORRECTION'
  supersedes: string
  replacement: Replacement
  reason: string
}

export type MatchEvent = BallEvent | TossEvent | DeclareEvent | PenaltyEvent | EndMatchEvent | CorrectionEvent
export type ScoredEvent = BallEvent | TossEvent | DeclareEvent | PenaltyEvent | EndMatchEvent

export interface BatterLine {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: Dismissal | null
  outOnSeq: number | null
}

export interface BowlerLine {
  playerId: string
  balls: number
  runs: number
  wickets: number
  wides: number
  noBalls: number
}

export interface InningsState {
  index: number
  battingTeamId: string
  bowlingTeamId: string
  runs: number
  wickets: number
  legalBalls: number
  extras: number
  freeHit: boolean
  strikerId: string | null
  nonStrikerId: string | null
  currentBowlerId: string | null
  lastOverBowlerId: string | null
  batters: Record<string, BatterLine>
  bowlers: Record<string, BowlerLine>
  battingOrder: string[]
  declared: boolean
  closed: boolean
  /** Deliveries of the over in progress, oldest first. Reset when the over changes. */
  thisOver: ThisOverBall[]
  /** Over number the current `thisOver` deliveries belong to, or null before play. */
  thisOverIndex: number | null
}

export type MatchResult =
  | { kind: 'WINNER'; teamId: string; by: 'RUNS' | 'WICKETS'; amount: number }
  | { kind: 'TIE' }
  | { kind: 'ABANDONED'; reason: string | null }

export interface MatchState {
  config: MatchConfig
  status: MatchStatus
  toss: TossEvent | null
  innings: InningsState[]
  overrideResult: MatchResult | null
  lastSeq: number
  eventCount: number
}

export interface ThisOverBall {
  label: string
  text: string
  wicket: boolean
  runs: number
}

export interface OverRateIndicator {
  ballsRemaining: number
  minutesRemaining: number
  projectedOvers: number
  over: boolean
}

export interface BattingCardLine {
  position: number
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: Dismissal | null
  isStriker: boolean
  isNonStriker: boolean
}

export interface BowlingCardLine {
  playerId: string
  balls: number
  oversText: string
  runs: number
  wickets: number
  wides: number
  noBalls: number
  economy: number
  isCurrentBowler: boolean
}

export interface InningsCard {
  index: number
  battingTeamId: string
  bowlingTeamId: string
  runs: number
  wickets: number
  legalBalls: number
  oversText: string
  extras: number
  runRate: number
  batting: BattingCardLine[]
  bowling: BowlingCardLine[]
  yetToBat: string[]
  declared: boolean
  closed: boolean
}

export interface Scorecard {
  status: MatchStatus
  innings: InningsCard[]
  result: MatchResult | null
}

export interface LiveScore {
  status: MatchStatus
  inningsIndex: number
  battingTeamId: string | null
  bowlingTeamId: string | null
  runs: number
  wickets: number
  oversText: string
  oversDecimal: number
  runRate: number
  target: number | null
  requiredRunRate: number | null
  freeHit: boolean
  declared: boolean
  powerplay: boolean
  ballsRemaining: number
  thisOver: ThisOverBall[]
  striker: BatterLine | null
  nonStriker: BatterLine | null
  bowler: BowlerLine | null
}

export type CommentaryKind = 'TOSS' | 'OVER' | 'BALL' | 'WICKET' | 'INNINGS' | 'END'

/** One line of ball-by-ball commentary; `over` is the delivery label ("18.3") for deliveries. */
export interface CommentaryLine {
  seq: number
  kind: CommentaryKind
  over: string | null
  text: string
}
