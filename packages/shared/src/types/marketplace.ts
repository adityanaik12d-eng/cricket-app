/**
 * Marketplace TypeScript interfaces
 * For team/player/official matchmaking and classifieds
 */

// ============================================
// ENUMS
// ============================================

export type LookingForType = 
  | 'team' 
  | 'player' 
  | 'umpire' 
  | 'scorer' 
  | 'commentator' 
  | 'ground'
  | 'coach'
  | 'physio'
  | 'sponsor';

export type PostStatus = 
  | 'active' 
  | 'filled' 
  | 'expired' 
  | 'cancelled' 
  | 'draft';

export type DayType = 
  | 'weekday' 
  | 'weekend' 
  | 'any';

export type BallType = 
  | 'leather_red' 
  | 'leather_white' 
  | 'tennis'
  | 'any';

// ============================================
// LOOKING POST (Main classified)
// ============================================

export interface LookingPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorIsPro: boolean;
  authorIsVerified: boolean;
  authorRating?: number;
  authorReviewCount?: number;
  // What they're looking for
  lookingFor: LookingForType;
  // Title & description
  title: string;
  description: string;
  // Requirements
  requirements: LookingRequirements;
  // Contact
  contactMethod: 'whatsapp' | 'phone' | 'in_app' | 'email';
  contactValue: string;       // Phone number, email, or user ID
  // Location
  city: string;
  state?: string;
  country: string;
  preferredGrounds?: string[];
  // Dates
  preferredDates: string[];   // ISO dates
  dayType: DayType;
  // Compensation
  compensation?: {
    type: 'per_match' | 'per_day' | 'per_tournament' | 'negotiable';
    amount?: number;          // INR
    currency: 'INR';
  };
  // Status
  status: PostStatus;
  // Engagement
  viewCount: number;
  contactCount: number;
  // Metadata
  postedAt: string;
  expiresAt?: string;
  updatedAt: string;
  // For filtering
  tags: string[];
}

export interface LookingRequirements {
  // For team
  teamLevel?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  teamAgeGroup?: 'u14' | 'u16' | 'u19' | 'u23' | 'senior' | 'veteran' | 'any';
  // For player
  playerRole?: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
  battingStyle?: 'right' | 'left' | 'any';
  bowlingStyle?: string;
  minExperience?: number;     // Years
  // For official
  officialRole?: 'umpire' | 'scorer' | 'commentator' | 'match_referee';
  certificationRequired?: string[];
  // For ground
  groundType?: 'turf' | 'mat' | 'concrete' | 'indoor';
  facilities?: string[];
  // Common
  ballType: BallType;
  matchFormat?: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED';
  oversPerInnings?: number;
  // Custom
  customRequirements?: string;
}

// ============================================
// POST CREATION FORMS
// ============================================

export interface CreateTeamPostData {
  lookingFor: 'team';
  title: string;
  description: string;
  requirements: {
    teamLevel: LookingRequirements['teamLevel'];
    teamAgeGroup: LookingRequirements['teamAgeGroup'];
    ballType: BallType;
    matchFormat?: LookingRequirements['matchFormat'];
    oversPerInnings?: number;
  };
  contactMethod: LookingPost['contactMethod'];
  contactValue: string;
  city: string;
  state?: string;
  country: string;
  preferredDates: string[];
  dayType: DayType;
  compensation?: LookingPost['compensation'];
  preferredGrounds?: string[];
  tags: string[];
}

export interface CreatePlayerPostData {
  lookingFor: 'player';
  title: string;
  description: string;
  requirements: {
    playerRole: LookingRequirements['playerRole'];
    battingStyle?: LookingRequirements['battingStyle'];
    bowlingStyle?: string;
    minExperience?: number;
    ballType: BallType;
    matchFormat?: LookingRequirements['matchFormat'];
  };
  contactMethod: LookingPost['contactMethod'];
  contactValue: string;
  city: string;
  state?: string;
  country: string;
  preferredDates: string[];
  dayType: DayType;
  compensation?: LookingPost['compensation'];
  tags: string[];
}

export interface CreateOfficialPostData {
  lookingFor: 'umpire' | 'scorer' | 'commentator';
  title: string;
  description: string;
  requirements: {
    officialRole: LookingRequirements['officialRole'];
    certificationRequired?: string[];
    experienceYears?: number;
    ballType: BallType;
    matchFormat?: LookingRequirements['matchFormat'];
  };
  contactMethod: LookingPost['contactMethod'];
  contactValue: string;
  city: string;
  state?: string;
  country: string;
  preferredDates: string[];
  dayType: DayType;
  compensation?: LookingPost['compensation'];
  tags: string[];
}

// ============================================
// FEED & FILTERS
// ============================================

export interface LookingFeedFilters {
  lookingFor?: LookingForType[];
  city?: string;
  state?: string;
  country?: string;
  dateRange?: { start: string; end: string };
  dayType?: DayType;
  ballType?: BallType[];
  matchFormat?: string[];
  minCompensation?: number;
  maxCompensation?: number;
  authorVerifiedOnly?: boolean;
  authorProOnly?: boolean;
  status?: PostStatus[];
  searchQuery?: string;
  sortBy?: 'recent' | 'expiring_soon' | 'highest_pay' | 'closest';
  radiusKm?: number;          // For location-based
  userLat?: number;
  userLng?: number;
}

export interface LookingFeedResponse {
  posts: LookingPost[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
  filters: LookingFeedFilters;
}

// ============================================
// CONTACT & INTERACTIONS
// ============================================

export interface PostContact {
  postId: string;
  contactorId: string;
  contactorName: string;
  contactorAvatarUrl?: string;
  message?: string;
  contactMethod: 'whatsapp' | 'phone' | 'in_app' | 'email';
  contactedAt: string;
  status: 'sent' | 'delivered' | 'read' | 'replied';
}

export interface PostShortlist {
  userId: string;
  postId: string;
  shortlistedAt: string;
  notes?: string;
}

// ============================================
// ORGANIZER PROFILE (Marketplace view)
// ============================================

export interface OrganizerMarketplaceProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  tournamentsOrganized: number;
  tournamentsCompleted: number;
  responseRate: number;       // 0-100%
  avgResponseTime: string;    // "2 hours"
  // Recent tournaments
  recentTournaments: {
    id: string;
    name: string;
    status: string;
    date: string;
  }[];
  // Reviews summary
  reviewsSummary: {
    rating: number;
    count: number;
    breakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
  }[];
  // Contact
  canMessage: boolean;
  whatsappNumber?: string;
  phoneNumber?: string;
}

// ============================================
// REVIEWS
// ============================================

export interface MarketplaceReview {
  id: string;
  revieweeId: string;         // Organizer or official
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  postId?: string;
  tournamentId?: string;
  rating: number;             // 1-5
  title: string;
  content: string;
  categories: {
    communication: number;
    punctuality: number;
    professionalism: number;
    fairness: number;
  };
  isVerified: boolean;        // Verified transaction
  createdAt: string;
  // Response
  response?: {
    content: string;
    createdAt: string;
  };
}