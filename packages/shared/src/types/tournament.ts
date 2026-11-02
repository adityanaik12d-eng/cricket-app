/**
 * Tournament-related TypeScript interfaces
 * Types for tournaments, standings, fixtures, and scheduling
 */

// ============================================
// ENUMS
// ============================================

export type TournamentCategory = 
  | 'OPEN' 
  | 'CORPORATE' 
  | 'COMMUNITY' 
  | 'SCHOOL' 
  | 'COLLEGE' 
  | 'UNIVERSITY' 
  | 'SERIES' 
  | 'OTHER';

export type TournamentStatus = 
  | 'draft' 
  | 'registration_open' 
  | 'registration_closed' 
  | 'scheduled' 
  | 'live' 
  | 'completed' 
  | 'cancelled';

export type TournamentFormat = 
  | 'league' 
  | 'knockout' 
  | 'group_knockout' 
  | 'round_robin' 
  | 'swiss' 
  | 'ladder';

export type FixtureStatus = 
  | 'scheduled' 
  | 'live' 
  | 'completed' 
  | 'abandoned' 
  | 'postponed' 
  | 'cancelled';

export type GroundType = 
  | 'turf' 
  | 'mat' 
  | 'concrete' 
  | 'indoor' 
  | 'other';

// ============================================
// TOURNAMENT CONTEXT
// ============================================

export interface TournamentOrganizer {
  id: string;
  name: string;
  isVerified: boolean;
  rating: number;           // 0-5
  reviewCount: number;
  avatarUrl?: string;
  phone?: string;
  email?: string;
}

export interface TournamentGround {
  id: string;
  name: string;
  address: string;
  city: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  type: GroundType;
  facilities?: string[];    // ['pavilion', 'lights', 'parking', 'scorer_table']
  images?: string[];
}

export interface TournamentGroup {
  id: string;
  name: string;             // e.g. "Group A", "Super 4"
  teamIds: string[];
  order: number;
}

export interface TournamentTeam {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  groupId?: string;
  captainId?: string;
  players: TournamentPlayer[];
  // Stats (computed)
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  points?: number;
  nrr?: number;
}

export interface TournamentPlayer {
  id: string;
  name: string;
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
  battingStyle?: 'right' | 'left';
  bowlingStyle?: 'right_arm_fast' | 'right_arm_medium' | 'right_arm_spin' | 'left_arm_fast' | 'left_arm_medium' | 'left_arm_spin';
  avatarUrl?: string;
  isPro?: boolean;
}

export interface TournamentContext {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  city: string;
  state?: string;
  country: string;
  category: TournamentCategory;
  format: TournamentFormat;
  status: TournamentStatus;
  organizer: TournamentOrganizer;
  groundIds: string[];
  grounds: TournamentGround[];
  groups: TournamentGroup[];
  teams: TournamentTeam[];
  // Schedule
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  matchType: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED';
  ballType: 'leather_red' | 'leather_white' | 'tennis';
  oversPerInnings: number;
  // Settings
  pointsForWin: number;
  pointsForTie: number;
  pointsForNoResult: number;
  nrrDecimalPlaces: number;
  // Sponsors
  sponsors?: TournamentSponsor[];
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TournamentSponsor {
  id: string;
  name: string;
  logoUrl: string;
  tier: 'title' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'partner';
  websiteUrl?: string;
}

// ============================================
// FIXTURES & SCHEDULE
// ============================================

export interface TournamentFixture {
  id: string;
  tournamentId: string;
  matchId?: string;         // Linked once match is created
  groupId?: string;
  round: string;            // e.g. "League", "Quarter Final", "Semi Final", "Final"
  roundOrder: number;
  matchNumber: number;
  team1Id: string;
  team2Id: string;
  groundId: string;
  scheduledDate: string;    // ISO date
  scheduledTime: string;    // HH:mm (24hr)
  status: FixtureStatus;
  // For knockout
  dependsOnMatchIds?: string[];  // Winner of match X vs Winner of match Y
  // Result (when completed)
  winnerTeamId?: string;
  resultMargin?: string;    // e.g. "5 wickets", "45 runs"
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleGeneratorConfig {
  tournamentId: string;
  method: 'manual' | 'auto';
  // Auto config
  autoConfig?: {
    groups: { id: string; name: string }[];
    dateRange: { start: string; end: string };
    grounds: { id: string; name: string; slotsPerDay: number }[];
    matchDurationMinutes: number;
    restDays?: number;
    avoidDates?: string[];
    format: 'single_round_robin' | 'double_round_robin' | 'knockout' | 'group_knockout';
    knockoutQualifiersPerGroup?: number;
  };
}

// ============================================
// STANDINGS & NRR
// ============================================

export interface GroupStandingRow {
  teamId: string;
  teamName: string;
  teamShortName?: string;
  teamLogoUrl?: string;
  matchesPlayed: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
  // For NRR calculation
  runsScoredTotal: number;
  oversFacedTotal: number;     // Decimal overs
  runsConcededTotal: number;
  oversBowledTotal: number;    // Decimal overs
  // Form
  recentForm: ('W' | 'L' | 'T' | 'N')[];  // Last 5 matches
  // Qualification status
  qualificationStatus?: 'qualified' | 'eliminated' | 'in_contention';
}

export interface GroupStandings {
  groupId: string;
  groupName: string;
  rows: GroupStandingRow[];
  lastUpdated: string;
}

export interface TournamentStandings {
  tournamentId: string;
  groups: GroupStandings[];
  // Cross-group for knockout stages
  knockoutBracket?: KnockoutBracket;
}

export interface KnockoutBracket {
  rounds: KnockoutRound[];
}

export interface KnockoutRound {
  name: string;               // "Quarter Finals", "Semi Finals", "Final"
  matches: KnockoutMatch[];
}

export interface KnockoutMatch {
  id: string;
  team1Id?: string;
  team2Id?: string;
  team1Source?: { matchId: string; position: 'winner' | 'loser' };
  team2Source?: { matchId: string; position: 'winner' | 'loser' };
  winnerId?: string;
  scheduledDate?: string;
  groundId?: string;
}

// ============================================
// LEADERBOARDS
// ============================================

export type LeaderboardCategory = 'bat' | 'bowl' | 'field' | 'mvp';
export type BattingMetric = 'runs' | 'average' | 'strike_rate' | 'highest_score' | 'fours' | 'sixes' | 'fifties' | 'hundreds';
export type BowlingMetric = 'wickets' | 'average' | 'economy' | 'strike_rate' | 'best_figures' | 'maidens' | 'dot_balls' | 'four_wickets' | 'five_wickets';
export type FieldingMetric = 'catches' | 'stumpings' | 'run_outs' | 'total_dismissals';
export type MVPMetric = 'mvp_points';

export type LeaderboardMetric = BattingMetric | BowlingMetric | FieldingMetric | MVPMetric;

export interface LeaderboardFilter {
  tournamentId: string;
  category: LeaderboardCategory;
  metric: LeaderboardMetric;
  teamId?: string;            // Filter by team
  minInnings?: number;
  minOvers?: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamShortName?: string;
  avatarUrl?: string;
  isPro: boolean;
  // Metrics (varies by category)
  innings?: number;
  runs?: number;
  average?: number;
  strikeRate?: number;
  highestScore?: number;
  fours?: number;
  sixes?: number;
  fifties?: number;
  hundreds?: number;
  wickets?: number;
  bowlingAverage?: number;
  economy?: number;
  bowlingStrikeRate?: number;
  bestFigures?: string;       // e.g. "4/12"
  maidens?: number;
  dotBalls?: number;
  fourWickets?: number;
  fiveWickets?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  mvpPoints?: number;
  // For tie-breaking
  tieBreakerValue?: number;
}

// ============================================
// NRR SCENARIO SIMULATOR
// ============================================

export interface NRRScenarioInput {
  tournamentId: string;
  teamId: string;
  opponentTeamId: string;
  matchOvers: number;
  // Scenario: 'bat_first' or 'chase'
  scenario: 'bat_first' | 'chase';
  // For bat_first: target runs to win by
  // For chase: overs to chase in
  targetValue: number;
  // Current tournament state
  currentStandings: GroupStandingRow[];
  remainingFixtures: TournamentFixture[];
}

export interface NRRScenarioResult {
  // Input
  input: NRRScenarioInput;
  // Output
  projectedNRR: number;
  projectedPoints: number;
  qualificationProbability: number;  // 0-1
  requiredMargin: {
    runs?: number;            // If bat_first
    overs?: number;           // If chase
  };
  // What-if scenarios
  scenarios: {
    description: string;
    nrr: number;
    qualifies: boolean;
  }[];
}

// ============================================
// TOURNAMENT REGISTRATION
// ============================================

export interface TournamentRegistrationForm {
  name: string;
  shortName?: string;
  description?: string;
  city: string;
  state?: string;
  country: string;
  category: TournamentCategory;
  format: TournamentFormat;
  matchType: TournamentContext['matchType'];
  ballType: TournamentContext['ballType'];
  oversPerInnings: number;
  startDate: string;
  endDate: string;
  groundId: string;
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  logoFile?: File;
  sponsors?: Omit<TournamentSponsor, 'id'>[];
}