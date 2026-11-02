/**
 * Banner & Social Asset TypeScript interfaces
 * For the Banner Studio / Poster generation system
 */

// ============================================
// TEMPLATE SYSTEM
// ============================================

export type BannerTemplateType = 
  | 'match_fixture' 
  | 'tournament_schedule' 
  | 'playing_xi' 
  | 'match_result' 
  | 'player_milestone' 
  | 'team_announcement'
  | 'custom';

export type BannerAspectRatio = 
  | '1:1'      // Instagram post / Square
  | '9:16'     // Instagram Story / Reel / TikTok
  | '16:9'     // YouTube thumbnail / Landscape
  | '4:5'      // Instagram portrait
  | '3:4'      // Pinterest
  | '2:3';     // Standard portrait

export interface BannerTemplate {
  id: string;
  name: string;
  type: BannerTemplateType;
  aspectRatio: BannerAspectRatio;
  description: string;
  thumbnailUrl: string;
  // Canvas config
  width: number;
  height: number;
  // Layer definitions
  layers: BannerLayer[];
  // Required data fields
  requiredFields: string[];
  // Optional customization
  customizableFields: BannerCustomField[];
  // Metadata
  isPremium: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BannerLayer {
  id: string;
  type: 'image' | 'text' | 'shape' | 'logo' | 'player_card' | 'team_badge' | 'score_card';
  name: string;
  // Position (percentage of canvas)
  x: number;      // 0-100
  y: number;      // 0-100
  width: number;  // 0-100
  height: number; // 0-100
  // Styling
  style: Record<string, any>;
  // Data binding
  dataKey?: string;         // Key in input data to bind
  fallbackValue?: any;
  // Constraints
  isRequired: boolean;
  isLocked: boolean;
  zIndex: number;
}

export interface BannerCustomField {
  key: string;
  label: string;
  type: 'text' | 'color' | 'font' | 'image' | 'select' | 'toggle';
  defaultValue: any;
  options?: { value: any; label: string }[];
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

// ============================================
// POSTER CONFIGS (INPUT DATA)
// ============================================

export interface MatchFixturePosterData {
  templateId: string;
  // Teams
  team1: {
    id: string;
    name: string;
    shortName: string;
    logoUrl: string;
    color?: string;           // Primary team color
  };
  team2: {
    id: string;
    name: string;
    shortName: string;
    logoUrl: string;
    color?: string;
  };
  // Tournament
  tournamentName: string;
  tournamentLogoUrl?: string;
  tournamentShortName?: string;
  // Match details
  matchNumber?: number;
  round?: string;             // "League", "QF", "SF", "Final"
  date: string;               // ISO date
  time: string;               // HH:mm
  timezone?: string;
  groundName: string;
  groundCity?: string;
  // Format
  overs: number;
  matchType: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED';
  ballType: 'leather_red' | 'leather_white' | 'tennis';
  // Sponsors
  sponsors?: {
    logoUrl: string;
    placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  }[];
  // Branding
  watermarkText?: string;     // "CricHeroes"
  watermarkUrl?: string;
  customText?: string;
  // Theme
  theme?: 'default' | 'dark' | 'vibrant' | 'minimal';
  primaryColor?: string;
  secondaryColor?: string;
}

export interface TournamentSchedulePosterData {
  templateId: string;
  tournamentName: string;
  tournamentLogoUrl?: string;
  tournamentShortName?: string;
  city: string;
  startDate: string;
  endDate: string;
  // Fixtures (subset for poster)
  fixtures: {
    date: string;
    time: string;
    team1: { name: string; shortName: string; logoUrl: string };
    team2: { name: string; shortName: string; logoUrl: string };
    groundName: string;
    round: string;
  }[];
  // Layout
  groupBy?: 'date' | 'ground' | 'team' | 'round';
  sponsors?: { logoUrl: string; placement: string }[];
  watermarkText?: string;
  theme?: string;
}

export interface PlayingXIPosterData {
  templateId: string;
  teamName: string;
  teamShortName: string;
  teamLogoUrl: string;
  teamColor?: string;
  matchInfo?: {
    opponentName: string;
    opponentLogoUrl: string;
    date: string;
    time: string;
    groundName: string;
  };
  tournamentName?: string;
  // Players (exactly 11)
  players: {
    id: string;
    name: string;
    role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
    battingStyle?: 'right' | 'left';
    bowlingStyle?: string;
    avatarUrl?: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isWicketKeeper: boolean;
    battingPosition?: number;
  }[];
  // Substitutes
  substitutes?: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  }[];
  sponsors?: { logoUrl: string }[];
  watermarkText?: string;
  theme?: string;
}

export interface MatchResultPosterData {
  templateId: string;
  // Result
  winnerTeam: {
    id: string;
    name: string;
    shortName: string;
    logoUrl: string;
  };
  loserTeam: {
    id: string;
    name: string;
    shortName: string;
    logoUrl: string;
  };
  margin: string;             // "5 wickets", "45 runs", "Super Over"
  // Match details
  tournamentName: string;
  date: string;
  groundName: string;
  // Scores
  team1Score: {
    runs: number;
    wickets: number;
    overs: number;
  };
  team2Score: {
    runs: number;
    wickets: number;
    overs: number;
  };
  // Key performers
  potm?: {
    playerId: string;
    playerName: string;
    teamName: string;
    avatarUrl?: string;
    stats: string;            // "55*(35) | 4.0-0-12-2"
    mvpRating?: number;
  };
  topBatter?: {
    playerName: string;
    runs: number;
    balls: number;
  };
  topBowler?: {
    playerName: string;
    wickets: number;
    runs: number;
    overs: number;
  };
  sponsors?: { logoUrl: string }[];
  watermarkText?: string;
  theme?: string;
}

// ============================================
// EXPORT OPTIONS
// ============================================

export interface BannerExportOptions {
  format: 'png' | 'jpg' | 'webp';
  quality: number;            // 0-1
  width?: number;             // Override template width
  height?: number;            // Override template height
  includeWatermark: boolean;
  backgroundColor?: string;   // For transparent templates
}

export interface GeneratedBanner {
  id: string;
  templateId: string;
  type: BannerTemplateType;
  data: any;                  // The input data used
  // Output
  imageUrl: string;           // CDN URL or data URL
  thumbnailUrl: string;
  // Metadata
  width: number;
  height: number;
  format: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
}

// ============================================
// BANNER STUDIO STATE
// ============================================

export interface BannerStudioState {
  selectedTemplate: BannerTemplate | null;
  inputData: any;
  previewCanvas: HTMLCanvasElement | null;
  isGenerating: boolean;
  generatedBanners: GeneratedBanner[];
  // Editor state
  selectedLayerId: string | null;
  layerOverrides: Record<string, Partial<BannerLayer>>;
  // History for undo/redo
  history: BannerStudioStateSnapshot[];
  historyIndex: number;
}

export interface BannerStudioStateSnapshot {
  inputData: any;
  layerOverrides: Record<string, Partial<BannerLayer>>;
  timestamp: number;
}