/**
 * Player & Profile TypeScript interfaces
 * Extended player statistics and profiles
 */

// ============================================
// PLAYER PROFILE
// ============================================

export interface PlayerProfile {
  id: string;
  name: string;
  shortName?: string;
  dateOfBirth?: string;
  age?: number;
  gender: 'male' | 'female' | 'other';
  nationality?: string;
  // Cricket specifics
  battingStyle: 'right' | 'left';
  bowlingStyle?: 'right_arm_fast' | 'right_arm_medium' | 'right_arm_spin' | 'left_arm_fast' | 'left_arm_medium' | 'left_arm_spin';
  primaryRole: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
  // Media
  avatarUrl?: string;
  coverImageUrl?: string;
  // Verification
  isVerified: boolean;
  isPro: boolean;
  // Contact (private)
  phone?: string;
  email?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CAREER STATISTICS
// ============================================

export interface CareerStats {
  playerId: string;
  // Overall
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  highestScore: number;
  average: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  bowlingAverage: number;
  economy: number;
  bowlingStrikeRate: number;
  bestFigures: string;
  fourWickets: number;
  fiveWickets: number;
  tenWickets: number;
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;
  // By format
  byFormat?: {
    T20?: Partial<CareerStats>;
    ODI?: Partial<CareerStats>;
    TEST?: Partial<CareerStats>;
    T10?: Partial<CareerStats>;
    HUNDRED?: Partial<CareerStats>;
  };
  // By tournament
  byTournament?: Record<string, Partial<CareerStats>>;
}

// ============================================
// RECENT PERFORMANCE
// ============================================

export interface RecentPerformance {
  playerId: string;
  lastMatches: number;        // e.g. last 5, last 10
  matches: {
    matchId: string;
    matchDate: string;
    tournamentName: string;
    opponent: string;
    batting?: {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      strikeRate: number;
      dismissal: string;
    };
    bowling?: {
      overs: number;
      maidens: number;
      runs: number;
      wickets: number;
      economy: number;
    };
    fielding?: {
      catches: number;
      stumpings: number;
      runOuts: number;
    };
    mvpPoints?: number;
    result: 'won' | 'lost' | 'tied' | 'no_result';
  }[];
}

// ============================================
// HEAD TO HEAD
// ============================================

export interface HeadToHead {
  playerId: string;
  opponentPlayerId: string;
  opponentName: string;
  matches: number;
  // Batting vs this bowler
  batting: {
    runs: number;
    balls: number;
    dismissals: number;
    average: number;
    strikeRate: number;
    fours: number;
    sixes: number;
  };
  // Bowling vs this batter
  bowling: {
    overs: number;
    runs: number;
    wickets: number;
    average: number;
    economy: number;
    strikeRate: number;
  };
}

// ============================================
// VENUE PERFORMANCE
// ============================================

export interface VenuePerformance {
  playerId: string;
  groundId: string;
  groundName: string;
  matches: number;
  batting: {
    runs: number;
    average: number;
    strikeRate: number;
    highestScore: number;
  };
  bowling: {
    wickets: number;
    average: number;
    economy: number;
  };
}

// ============================================
// PLAYER AVAILABILITY (for marketplace)
// ============================================

export type AvailabilityStatus = 'available' | 'busy' | 'injured' | 'unavailable';

export interface PlayerAvailability {
  playerId: string;
  playerName: string;
  status: AvailabilityStatus;
  preferredFormats: ('T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED')[];
  preferredRoles: ('batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper')[];
  availableDates?: string[];        // ISO dates
  unavailableDates?: string[];      // ISO dates
  preferredCities?: string[];
  expectedFee?: number;             // Per match/day
  ballTypePreference?: ('leather_red' | 'leather_white' | 'tennis')[];
  notes?: string;
  updatedAt: string;
}

// ============================================
// OFFICIAL PROFILE (Umpire/Scorer/Commentator)
// ============================================

export type OfficialRole = 'umpire' | 'scorer' | 'commentator' | 'match_referee';

export interface OfficialProfile {
  id: string;
  name: string;
  roles: OfficialRole[];
  certifications: string[];       // ['BCCI Level 1', 'ICC Elite']
  experienceYears: number;
  matchesOfficiated: number;
  rating: number;                 // 0-5
  reviewCount: number;
  avatarUrl?: string;
  isVerified: boolean;
  isAvailable: boolean;
  preferredCities: string[];
  preferredFormats: string[];
  feePerDay: number;              // INR
  feePerMatch?: number;
  languages: string[];            // For commentators
  phone?: string;
  email?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}