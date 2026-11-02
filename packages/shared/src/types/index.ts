/**
 * Barrel export for all shared types
 */

export * from './match';
export * from './tournament';
export * from './player';
export * from './banner';
export * from './marketplace';

// Re-export BallType from match only (tournament also has it but we use match's)
export type { BallType } from './match';

// ============================================
// COMMON UTILITY TYPES
// ============================================

export type ISODateString = string;
export type ISODateTimeString = string;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ============================================
// CRICKET CONSTANTS
// ============================================

export const CRICKET_CONSTANTS = {
  // Match
  MAX_OVERS_T20: 20,
  MAX_OVERS_ODI: 50,
  MAX_OVERS_TEST: 90,       // Per day
  MAX_OVERS_T10: 10,
  MAX_OVERS_HUNDRED: 100,   // Balls
  
  // Players
  PLAYERS_PER_TEAM: 11,
  MAX_SUBSTITUTES: 5,
  
  // Scoring
  MAX_RUNS_PER_BALL: 6,
  WIDE_RUNS: 1,
  NO_BALL_RUNS: 1,
  
  // Dismissals
  DISMISSAL_TYPES: [
    'bowled', 'caught', 'lbw', 'run_out', 'stumped', 
    'hit_wicket', 'retired_hurt', 'obstructing_field', 
    'handled_ball', 'timed_out'
  ] as const,
  
  // Extras
  EXTRAS_TYPES: ['wides', 'no_balls', 'byes', 'leg_byes', 'penalty'] as const,
  
  // Colors (from CricHeroes analysis)
  COLORS: {
    PRIMARY_RED: '#D32F2F',
    PRIMARY_RED_LIGHT: '#E53935',
    TEAL: '#00897B',
    TEAL_DARK: '#00796B',
    GREEN: '#2E7D32',         // Boundaries (4s), positive NRR
    PURPLE: '#7B1FA2',        // Sixes
    GOLD: '#FBC02D',          // MVP highlights
    RED_WICKET: '#D32F2F',    // Wickets, dismissals
    GREY_NEUTRAL: '#F5F5F5',  // Cards background
  },
  
  // NRR
  NRR_DECIMAL_PLACES: 3,
  
  // MVP
  MAX_MVP_POINTS: 10.0,
  
  // DLS
  DLS_VERSION: '5.0',
} as const;

// ============================================
// TYPE GUARDS
// ============================================

export function isLiveMatch(status: string): status is 'live' {
  return status === 'live';
}

export function isCompletedMatch(status: string): status is 'completed' {
  return status === 'completed';
}

export function isValidOver(over: number, maxOvers: number): boolean {
  return over >= 0 && over < maxOvers;
}

export function isValidBall(ball: number): boolean {
  return ball >= 1 && ball <= 6;
}

export function formatOvers(balls: number): string {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return remainingBalls > 0 ? `${overs}.${remainingBalls}` : `${overs}.0`;
}

export function parseOvers(oversString: string): number {
  const parts = oversString.split('.');
  const ballsStr = parts[1] ?? '0';
  const balls = parseInt(ballsStr, 10);
  return parseInt(parts[0], 10) * 6 + balls;
}