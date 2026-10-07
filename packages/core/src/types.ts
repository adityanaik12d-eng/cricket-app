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
}