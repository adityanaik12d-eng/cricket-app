/**
 * Match-related TypeScript interfaces
 * Core types for live match state, ball events, and scoring
 */

// ============================================
// ENUMS & BASIC TYPES
// ============================================

export type MatchStatus = 
  | 'upcoming' 
  | 'live' 
  | 'innings_break' 
  | 'completed' 
  | 'abandoned';

export type BallType = 
  | 'leather_red' 
  | 'leather_white' 
  | 'tennis';

export type InningsNumber = 1 | 2;

export type DismissalType = 
  | 'bowled' 
  | 'caught' 
  | 'lbw' 
  | 'run_out' 
  | 'stumped' 
  | 'hit_wicket' 
  | 'retired_hurt' 
  | 'obstructing_field'
  | 'handled_ball'
  | 'timed_out';

export type ExtrasType = 'wides' | 'no_balls' | 'byes' | 'leg_byes' | 'penalty';

export type TossDecision = 'bat' | 'bowl';

// ============================================
// BALL-BY-BALL EVENT STREAM
// ============================================

export interface Extras {
  wides?: number;
  noBalls?: number;
  byes?: number;
  legByes?: number;
  penalty?: number;
}

export interface Dismissal {
  type: DismissalType;
  dismissedPlayerId: string;
  fielderId?: string;
  bowlerId?: string;
  commentaryText: string;
}

export interface BallEvent {
  matchId: string;
  inningsNumber: InningsNumber;
  overNumber: number;           // 0-indexed (0 to 19 for T20, 0 to 49 for ODI)
  ballNumber: number;           // Legal ball count within over (1 to 6)
  bowlerId: string;
  strikerId: string;
  nonStrikerId: string;
  runsBat: number;              // Runs off the bat (0-6)
  extras: Extras;
  isLegalDelivery: boolean;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  dismissal?: Dismissal;
  timestamp: string;            // ISO 8601
  // Computed fields (not stored, derived)
  totalRuns?: number;           // runsBat + sum(extras)
  isWicket?: boolean;
  isDotBall?: boolean;
}

export interface OverSummary {
  overNumber: number;
  balls: BallEvent[];
  runs: number;
  wickets: number;
  isMaiden: boolean;
  bowlerId: string;
}

// ============================================
// PLAYER PERFORMANCE IN A MATCH
// ============================================

export interface BattingScorecardRow {
  playerId: string;
  playerName: string;
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
  battingPosition: number;
  dismissalDescription: string;  // e.g. "c †Prince Patel b Alok Barot"
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  minutesAtCrease: number;
}

export interface BowlingScorecardRow {
  playerId: string;
  playerName: string;
  overs: number;                // Decimal overs (e.g. 3.4 = 3 overs 4 balls)
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  dots: number;
  noBalls: number;
  wides: number;
}

export interface FieldingStats {
  catches: number;
  stumpings: number;
  runOutsDirect: number;
  runOutsAssisted: number;
}

export interface PlayerMatchPerformance {
  playerId: string;
  playerName: string;
  teamId: string;
  batting?: BattingScorecardRow;
  bowling?: BowlingScorecardRow;
  fielding?: FieldingStats;
  mvpPoints?: number;
}

// ============================================
// PARTNERSHIP PROGRESSION
// ============================================

export interface Partnership {
  wicketNumber: number;         // 1-10 (partnership for this wicket)
  playerOneId: string;
  playerOneRuns: number;
  playerOneBalls: number;
  playerTwoId: string;
  playerTwoRuns: number;
  playerTwoBalls: number;
  totalRuns: number;
  totalBalls: number;
  startOver: number;
  endOver: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;
  overs: number;                // Decimal overs when wicket fell
  dismissedPlayerName: string;
  dismissedPlayerId: string;
  bowlerId: string;
}

// ============================================
// INNINGS & TEAM STATE
// ============================================

export interface TeamInningsSummary {
  teamId: string;
  teamName: string;
  runs: number;
  wickets: number;
  oversCompleted: number;       // e.g. 15.4
  maxOvers: number;
  extrasTotal: number;
  runRate: number;
  requiredRunRate?: number;     // For chasing team
  targetScore?: number;         // For chasing team
  battingRoster: BattingScorecardRow[];
  bowlingRoster: BowlingScorecardRow[];
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  powerplayRuns?: number;       // Runs in powerplay
  powerplayWickets?: number;
}

// ============================================
// DLS / TARGET REVISION
// ============================================

export type DLSMethod = 'DLS_5_0' | 'VJD';

export interface DLSState {
  isApplied: boolean;
  method: DLSMethod;
  oversLost: number;
  revisedTarget: number;
  revisedOvers: number;
  parScoreAtInterruption?: number;
  wicketsAtInterruption?: number;
  oversAtInterruption?: number;
}

export interface DLSCalculationInput {
  method: DLSMethod;
  inningsNumber: 1 | 2;
  oversCompleted: number;
  wicketsLost: number;
  targetScore: number;
  maxOvers: number;
  oversLost: number;
}

// ============================================
// MVP / PLAYER OF THE MATCH
// ============================================

export interface MVPAward {
  playerId: string;
  playerName: string;
  teamName: string;
  points: number;               // Out of 10.0
  statHighlights: string;       // e.g. "55*(35) | 4.0-0-12-2"
  breakdown: {
    battingPoints: number;
    bowlingPoints: number;
    fieldingPoints: number;
  };
}

// ============================================
// TOSS
// ============================================

export interface TossResult {
  wonByTeamId: string;
  electedTo: TossDecision;
}

// ============================================
// COMPLETE MATCH STATE
// ============================================

export interface MatchState {
  id: string;
  tournamentId?: string;
  status: MatchStatus;
  scheduledStartTime: string;   // ISO 8601
  actualStartTime?: string;
  endTime?: string;
  groundName: string;
  groundId?: string;
  matchType: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED';
  ballType: BallType;
  toss: TossResult;
  innings: [TeamInningsSummary, TeamInningsSummary?];
  currentInningsIndex: 0 | 1;
  dlsState?: DLSState;
  mvpAward?: MVPAward;
  // Live scoring state
  currentOver?: number;
  currentBall?: number;
  strikerId?: string;
  nonStrikerId?: string;
  bowlerId?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
  version: number;              // For optimistic locking
}

// ============================================
// MATCH LIST / SUMMARY (for feeds)
// ============================================

export interface MatchSummary {
  id: string;
  tournamentId?: string;
  tournamentName?: string;
  team1: { id: string; name: string; shortName?: string; logo?: string };
  team2: { id: string; name: string; shortName?: string; logo?: string };
  status: MatchStatus;
  scheduledStartTime: string;
  groundName: string;
  matchType: MatchState['matchType'];
  // If live/completed
  currentScore?: string;        // e.g. "145/3 (12.4)"
  target?: string;              // e.g. "Target: 180"
  result?: string;              // e.g. "Team1 won by 5 wickets"
  isLive: boolean;
}