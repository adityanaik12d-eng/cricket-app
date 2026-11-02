/**
 * Cricket-specific formatters and utility functions
 */

import type { BallEvent, BattingScorecardRow, BowlingScorecardRow, MatchState, MatchStatus } from '../types';

// ============================================
// OVERS FORMATTING
// ============================================

/**
 * Convert balls to overs string (e.g., 22 balls -> "3.4")
 */
export function ballsToOvers(balls: number): string {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
}

/**
 * Convert overs string to balls (e.g., "3.4" -> 22)
 */
export function oversToBalls(oversString: string): number {
  const parts = oversString.split('.');
  const ballsStr = parts[1] ?? '0';
  return parseInt(parts[0]) * 6 + parseInt(ballsStr as string);
}

/**
 * Format overs for display (ensures .0 for complete overs)
 */
export function formatOvers(overs: number): string {
  const oversInt = Math.floor(overs);
  const balls = Math.round((overs - oversInt) * 10);
  return balls > 0 ? `${oversInt}.${balls}` : `${oversInt}.0`;
}

/**
 * Parse various overs formats to decimal
 */
export function parseOvers(input: string | number): number {
  if (typeof input === 'number') return input;
  const parts = input.split('.');
  const ballsStr = parts[1] ?? '0';
  return parseInt(parts[0]) + parseInt(ballsStr as string) / 10;
}

// ============================================
// SCORE FORMATTING
// ============================================

/**
 * Format team score (e.g., "189/5 (20.0 Ov)")
 */
export function formatTeamScore(runs: number, wickets: number, overs?: number): string {
  let score = `${runs}/${wickets}`;
  if (overs !== undefined) {
    score += ` (${formatOvers(overs)} Ov)`;
  }
  return score;
}

/**
 * Format run rate (e.g., "9.45")
 */
export function formatRunRate(runs: number, overs: number): string {
  if (overs === 0) return '0.00';
  return (runs / overs).toFixed(2);
}

/**
 * Format required run rate
 */
export function formatRequiredRunRate(runsNeeded: number, oversRemaining: number): string {
  if (oversRemaining <= 0) return runsNeeded > 0 ? '∞' : '0.00';
  return (runsNeeded / oversRemaining).toFixed(2);
}

// ============================================
// BATTING FORMATTING
// ============================================

/**
 * Format batting score (e.g., "55*(35)")
 */
export function formatBattingScore(row: BattingScorecardRow): string {
  const notOut = !row.dismissalDescription.toLowerCase().includes('out') &&
                 !row.dismissalDescription.toLowerCase().includes('retired');
  const star = notOut ? '*' : '';
  return `${row.runs}${star}(${row.ballsFaced})`;
}

/**
 * Format dismissal for display
 */
export function formatDismissal(dismissal: string): string {
  // Clean up common dismissal strings
  return dismissal
    .replace(/†/g, '†')  // Keep wicketkeeper symbol
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format strike rate
 */
export function formatStrikeRate(sr: number): string {
  return sr.toFixed(2);
}

/**
 * Get batting milestone label
 */
export function getBattingMilestone(runs: number): string | null {
  if (runs >= 100) return '💯';
  if (runs >= 50) return '🏏';
  return null;
}

// ============================================
// BOWLING FORMATTING
// ============================================

/**
 * Format bowling figures (e.g., "4.0-0-12-2")
 */
export function formatBowlingFigures(row: BowlingScorecardRow): string {
  return `${formatOvers(row.overs)}-${row.maidens}-${row.runsConceded}-${row.wickets}`;
}

/**
 * Format economy rate
 */
export function formatEconomy(econ: number): string {
  return econ.toFixed(2);
}

/**
 * Format bowling average
 */
export function formatBowlingAverage(avg: number): string {
  return avg.toFixed(2);
}

/**
 * Get bowling milestone label
 */
export function getBowlingMilestone(wickets: number): string | null {
  if (wickets >= 5) return '🎯'; // 5-wicket haul
  if (wickets >= 4) return '⭐';  // 4-wicket haul
  if (wickets >= 3) return '🎯'; // 3-wicket haul
  return null;
}

// ============================================
// PARTNERSHIP FORMATTING
// ============================================

/**
 * Format partnership (e.g., "45 (32) - Sharma/Rohit")
 */
export function formatPartnership(
  partnership: { runs: number; balls: number; player1: string; player2: string }
): string {
  return `${partnership.runs} (${partnership.balls}) - ${partnership.player1}/${partnership.player2}`;
}

// ============================================
// FALL OF WICKETS FORMATTING
// ============================================

/**
 * Format fall of wicket (e.g., "1-25 (Sharma, 4.2)")
 */
export function formatFallOfWicket(
  fow: { wicketNumber: number; score: number; overs: number; dismissedPlayer: string }
): string {
  return `${fow.wicketNumber}-${fow.score} (${fow.dismissedPlayer}, ${formatOvers(fow.overs)})`;
}

// ============================================
// MATCH STATUS FORMATTING
// ============================================

/**
 * Get user-friendly match status label
 */
export function getMatchStatusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    upcoming: 'Upcoming',
    live: 'LIVE',
    innings_break: 'Innings Break',
    completed: 'Completed',
    abandoned: 'Abandoned',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getMatchStatusColor(status: MatchStatus): string {
  const colors: Record<MatchStatus, string> = {
    upcoming: '#757575',      // Grey
    live: '#D32F2F',          // Red (CricHeroes brand)
    innings_break: '#FF9800', // Orange
    completed: '#2E7D32',     // Green
    abandoned: '#757575',     // Grey
  };
  return colors[status] || '#757575';
}

/**
 * Check if match is in progress
 */
export function isMatchInProgress(status: MatchStatus): boolean {
  return status === 'live' || status === 'innings_break';
}

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format match duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(targetDate: string): string {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) return 'Started';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================
// COMMENTARY FORMATTING
// ============================================

/**
 * Generate commentary text for a ball
 */
export function generateCommentaryText(ball: BallEvent): string {
  const parts: string[] = [];
  
  // Over/ball
  parts.push(`${ball.overNumber + 1}.${ball.ballNumber}`);
  
  // Extras
  const extras: string[] = [];
  if (ball.extras.wides) extras.push(`${ball.extras.wides}wd`);
  if (ball.extras.noBalls) extras.push(`${ball.extras.noBalls}nb`);
  if (ball.extras.byes) extras.push(`${ball.extras.byes}b`);
  if (ball.extras.legByes) extras.push(`${ball.extras.legByes}lb`);
  if (extras.length) parts.push(extras.join('+'));
  
  // Runs
  if (ball.isBoundarySix) parts.push('6️⃣');
  else if (ball.isBoundaryFour) parts.push('4️⃣');
  else if (ball.runsBat > 0) parts.push(ball.runsBat.toString());
  else if (ball.isLegalDelivery) parts.push('•');
  
  // Wicket
  if (ball.dismissal) {
    const dis = ball.dismissal;
    let wicketText = 'W';
    if (dis.type === 'bowled') wicketText = '🎯 Bowled';
    else if (dis.type === 'caught') wicketText = '🤲 Caught';
    else if (dis.type === 'lbw') wicketText = '🦵 LBW';
    else if (dis.type === 'run_out') wicketText = '🏃 Run Out';
    else if (dis.type === 'stumped') wicketText = '🧤 Stumped';
    parts.push(wicketText);
  }
  
  return parts.join(' ');
}

/**
 * Generate short commentary for scorecard
 */
export function generateShortCommentary(ball: BallEvent): string {
  if (ball.dismissal) {
    return `W: ${ball.dismissal.commentaryText}`;
  }
  if (ball.isBoundarySix) return '6';
  if (ball.isBoundaryFour) return '4';
  if (ball.runsBat > 0) return ball.runsBat.toString();
  if (ball.extras.wides || ball.extras.noBalls) {
    const e = [];
    if (ball.extras.wides) e.push(`${ball.extras.wides}wd`);
    if (ball.extras.noBalls) e.push(`${ball.extras.noBalls}nb`);
    return e.join(',');
  }
  return '•';
}

// ============================================
// NRR FORMATTING
// ============================================

/**
 * Format NRR with sign
 */
export function formatNRR(nrr: number): string {
  const sign = nrr >= 0 ? '+' : '';
  return `${sign}${nrr.toFixed(3)}`;
}

/**
 * Get NRR color
 */
export function getNRRColor(nrr: number): string {
  if (nrr > 0) return '#2E7D32'; // Green
  if (nrr < 0) return '#D32F2F'; // Red
  return '#757575'; // Grey
}

// ============================================
// MATCH SUMMARY FORMATTING
// ============================================

/**
 * Generate one-line match summary
 */
export function formatMatchSummary(match: MatchState): string {
  const innings = match.innings;
  if (!innings[0]) return 'Match not started';
  
  const team1 = innings[0];
  const team2 = innings[1];
  
  if (match.status === 'live') {
    if (match.currentInningsIndex === 0) {
      return `${team1.teamName}: ${formatTeamScore(team1.runs, team1.wickets, team1.oversCompleted)}`;
    } else if (team2) {
      const target = team2.targetScore ? `Target: ${team2.targetScore}` : '';
      return `${team2.teamName}: ${formatTeamScore(team2.runs, team2.wickets, team2.oversCompleted)} ${target}`;
    }
  }
  
  if (match.status === 'completed' && team2) {
    if (team1.runs > team2.runs) {
      return `${team1.teamName} won by ${team1.runs - team2.runs} runs`;
    } else if (team2.runs > team1.runs) {
      return `${team2.teamName} won by ${10 - team2.wickets} wickets`;
    } else {
      return 'Match Tied';
    }
  }
  
  return `${team1.teamName} vs ${team2?.teamName || 'TBD'}`;
}

// ============================================
// DEEP LINK GENERATION
// ============================================

/**
 * Generate deep link for match state
 */
export function generateMatchDeepLink(
  matchId: string,
  params: {
    tab?: 'info' | 'summary' | 'scorecard' | 'commentary' | 'squads';
    innings?: 1 | 2;
    over?: number;
    ball?: number;
  } = {}
): string {
  const searchParams = new URLSearchParams();
  if (params.tab) searchParams.set('tab', params.tab);
  if (params.innings) searchParams.set('innings', params.innings.toString());
  if (params.over !== undefined) searchParams.set('over', params.over.toString());
  if (params.ball !== undefined) searchParams.set('ball', params.ball.toString());
  
  const query = searchParams.toString();
  return `/matches/${matchId}${query ? `?${query}` : ''}`;
}

/**
 * Generate WhatsApp share URL
 */
export function generateWhatsAppShareUrl(text: string, phoneNumber?: string): string {
  const encodedText = encodeURIComponent(text);
  return phoneNumber 
    ? `https://wa.me/${phoneNumber}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Generate match share text
 */
export function generateMatchShareText(match: MatchState, origin?: string): string {
  const summary = formatMatchSummary(match);
  const globalWindow = typeof globalThis !== 'undefined' && 'window' in globalThis 
    ? (globalThis as any).window 
    : undefined;
  const baseUrl = origin ?? (globalWindow?.location?.origin ?? '');
  return `🏏 ${match.innings[0]?.teamName} vs ${match.innings[1]?.teamName}\n${summary}\n\nFollow live: ${baseUrl}/matches/${match.id}`;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate ball event
 */
export function validateBallEvent(ball: BallEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (ball.overNumber < 0) errors.push('Over number cannot be negative');
  if (ball.ballNumber < 1 || ball.ballNumber > 6) errors.push('Ball number must be 1-6');
  if (ball.runsBat < 0 || ball.runsBat > 6) errors.push('Runs off bat must be 0-6');
  if (ball.extras.wides && ball.extras.wides < 0) errors.push('Wides cannot be negative');
  if (ball.extras.noBalls && ball.extras.noBalls < 0) errors.push('No balls cannot be negative');
  if (ball.totalRuns !== undefined && ball.totalRuns < 0) errors.push('Total runs cannot be negative');
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate scorecard row totals match team total
 */
export function validateScorecardTotals(
  batting: BattingScorecardRow[],
  extras: number,
  teamTotal: number
): { valid: boolean; difference: number } {
  const battingRuns = batting.reduce((sum, b) => sum + b.runs, 0);
  const calculatedTotal = battingRuns + extras;
  return { valid: calculatedTotal === teamTotal, difference: calculatedTotal - teamTotal };
}