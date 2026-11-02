/**
 * MVP (Most Valuable Player) / Player of the Match Algorithm
 * Algorithmic calculation based on batting, bowling, and fielding contributions
 */

import type { BallEvent, MVPAward, PlayerMatchPerformance } from '../types';

// ============================================
// MVP WEIGHTS CONFIGURATION
// ============================================

export interface MVPWeights {
  // Batting
  runsPerRun: number;           // Points per run scored
  boundaryFourBonus: number;    // Bonus per four
  boundarySixBonus: number;     // Bonus per six
  strikeRateMultiplier: number; // SR impact (above/below par)
  fiftyBonus: number;           // Bonus for 50+
  hundredBonus: number;         // Bonus for 100+
  notOutBonus: number;          // Bonus for remaining not out
  
  // Bowling
  wicketPoints: number;         // Points per wicket
  maidenOverBonus: number;      // Bonus per maiden
  economyMultiplier: number;    // Economy impact (below par = positive)
  dotBallPoints: number;        // Points per dot ball
  fourWicketBonus: number;      // Bonus for 4-wicket haul
  fiveWicketBonus: number;      // Bonus for 5-wicket haul
  
  // Fielding
  catchPoints: number;          // Points per catch
  stumpingPoints: number;       // Points per stumping
  runOutDirectPoints: number;   // Points per direct run out
  runOutAssistedPoints: number; // Points per assisted run out
  
  // Match context
  winningTeamMultiplier: number; // Multiplier if on winning team
  momBonus: number;              // Flat bonus for official MOM
}

export const DEFAULT_MVP_WEIGHTS: MVPWeights = {
  // Batting
  runsPerRun: 1.0,
  boundaryFourBonus: 0.5,
  boundarySixBonus: 1.0,
  strikeRateMultiplier: 0.05,   // Per 10 SR above/below par (par ~130)
  fiftyBonus: 3.0,
  hundredBonus: 8.0,
  notOutBonus: 2.0,
  
  // Bowling
  wicketPoints: 15.0,
  maidenOverBonus: 2.0,
  economyMultiplier: 0.5,       // Per 1.0 economy below par (par ~8.0)
  dotBallPoints: 0.3,
  fourWicketBonus: 5.0,
  fiveWicketBonus: 12.0,
  
  // Fielding
  catchPoints: 4.0,
  stumpingPoints: 5.0,
  runOutDirectPoints: 6.0,
  runOutAssistedPoints: 3.0,
  
  // Match context
  winningTeamMultiplier: 1.15,
  momBonus: 10.0,
};

// T20 specific weights (higher emphasis on strike rate / economy)
export const T20_MVP_WEIGHTS: MVPWeights = {
  ...DEFAULT_MVP_WEIGHTS,
  runsPerRun: 1.2,
  boundaryFourBonus: 0.8,
  boundarySixBonus: 1.5,
  strikeRateMultiplier: 0.08,
  fiftyBonus: 4.0,
  hundredBonus: 12.0,
  wicketPoints: 18.0,
  economyMultiplier: 0.8,
  dotBallPoints: 0.5,
};

// ODI specific weights
export const ODI_MVP_WEIGHTS: MVPWeights = {
  ...DEFAULT_MVP_WEIGHTS,
  runsPerRun: 1.0,
  strikeRateMultiplier: 0.03,
  fiftyBonus: 3.0,
  hundredBonus: 10.0,
  wicketPoints: 15.0,
  economyMultiplier: 0.4,
  dotBallPoints: 0.2,
};

// ============================================
// PAR VALUES (Format-specific benchmarks)
// ============================================

export interface ParValues {
  battingStrikeRate: number;
  bowlingEconomy: number;
  bowlingStrikeRate: number;    // Balls per wicket
}

export const PAR_VALUES: Record<string, ParValues> = {
  T20: { battingStrikeRate: 135, bowlingEconomy: 8.0, bowlingStrikeRate: 18 },
  ODI: { battingStrikeRate: 90, bowlingEconomy: 5.5, bowlingStrikeRate: 35 },
  TEST: { battingStrikeRate: 50, bowlingEconomy: 3.0, bowlingStrikeRate: 60 },
  T10: { battingStrikeRate: 160, bowlingEconomy: 9.5, bowlingStrikeRate: 12 },
  HUNDRED: { battingStrikeRate: 145, bowlingEconomy: 8.5, bowlingStrikeRate: 15 },
};

// ============================================
// MVP CALCULATION
// ============================================

export interface MVPBreakdown {
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  contextPoints: number;
  total: number;
  details: {
    batting: BattingMVPDetails;
    bowling: BowlingMVPDetails;
    fielding: FieldingMVPDetails;
    context: ContextMVPDetails;
  };
}

export interface BattingMVPDetails {
  runsPoints: number;
  boundaryPoints: number;
  strikeRatePoints: number;
  milestonePoints: number;
  notOutPoints: number;
  subtotal: number;
}

export interface BowlingMVPDetails {
  wicketPoints: number;
  maidenPoints: number;
  economyPoints: number;
  dotBallPoints: number;
  haulPoints: number;
  subtotal: number;
}

export interface FieldingMVPDetails {
  catchPoints: number;
  stumpingPoints: number;
  runOutPoints: number;
  subtotal: number;
}

export interface ContextMVPDetails {
  winningTeamPoints: number;
  momPoints: number;
  subtotal: number;
}

/**
 * Calculate MVP points for a player's match performance
 */
export function calculateMVP(
  performance: PlayerMatchPerformance,
  matchResult: 'won' | 'lost' | 'tied' | 'no_result',
  isOfficialMOM: boolean = false,
  format: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED' = 'T20',
  weights: MVPWeights = DEFAULT_MVP_WEIGHTS
): MVPBreakdown {
  const par = PAR_VALUES[format] ?? PAR_VALUES['T20'];
  // par is guaranteed to be defined after nullish coalescing
  const parValues = par!;
  
  // --- BATTING ---
  const batting = performance.batting;
  const battingDetails: BattingMVPDetails = {
    runsPoints: 0,
    boundaryPoints: 0,
    strikeRatePoints: 0,
    milestonePoints: 0,
    notOutPoints: 0,
    subtotal: 0,
  };
  
  if (batting && batting.ballsFaced > 0) {
    battingDetails.runsPoints = batting.runs * weights.runsPerRun;
    battingDetails.boundaryPoints = batting.fours * weights.boundaryFourBonus + batting.sixes * weights.boundarySixBonus;
    
    // Strike rate impact
    const srDiff = batting.strikeRate - parValues.battingStrikeRate;
    battingDetails.strikeRatePoints = (srDiff / 10) * weights.strikeRateMultiplier * batting.ballsFaced;
    
    // Milestones
    if (batting.runs >= 100) battingDetails.milestonePoints += weights.hundredBonus;
    else if (batting.runs >= 50) battingDetails.milestonePoints += weights.fiftyBonus;
    
    // Not out bonus
    if (!batting.dismissalDescription.toLowerCase().includes('out') && 
        !batting.dismissalDescription.toLowerCase().includes('retired')) {
      battingDetails.notOutPoints = weights.notOutBonus;
    }
  }
  
  battingDetails.subtotal = Object.values(battingDetails).reduce((a, b) => a + b, 0);
  
  // --- BOWLING ---
  const bowling = performance.bowling;
  const bowlingDetails: BowlingMVPDetails = {
    wicketPoints: 0,
    maidenPoints: 0,
    economyPoints: 0,
    dotBallPoints: 0,
    haulPoints: 0,
    subtotal: 0,
  };
  
  if (bowling && bowling.overs > 0) {
    bowlingDetails.wicketPoints = bowling.wickets * weights.wicketPoints;
    bowlingDetails.maidenPoints = bowling.maidens * weights.maidenOverBonus;
    
    // Economy impact (lower is better)
    const econDiff = parValues.bowlingEconomy - bowling.economy;
    bowlingDetails.economyPoints = econDiff * weights.economyMultiplier * bowling.overs;
    
    bowlingDetails.dotBallPoints = bowling.dots * weights.dotBallPoints;
    
    // Wicket hauls
    if (bowling.wickets >= 5) bowlingDetails.haulPoints += weights.fiveWicketBonus;
    else if (bowling.wickets >= 4) bowlingDetails.haulPoints += weights.fourWicketBonus;
  }
  
  bowlingDetails.subtotal = Object.values(bowlingDetails).reduce((a, b) => a + b, 0);
  
  // --- FIELDING ---
  const fielding = performance.fielding;
  const fieldingDetails: FieldingMVPDetails = {
    catchPoints: 0,
    stumpingPoints: 0,
    runOutPoints: 0,
    subtotal: 0,
  };
  
  if (fielding) {
    fieldingDetails.catchPoints = fielding.catches * weights.catchPoints;
    fieldingDetails.stumpingPoints = fielding.stumpings * weights.stumpingPoints;
    fieldingDetails.runOutPoints = fielding.runOutsDirect * weights.runOutDirectPoints + 
                                    fielding.runOutsAssisted * weights.runOutAssistedPoints;
  }
  
  fieldingDetails.subtotal = Object.values(fieldingDetails).reduce((a, b) => a + b, 0);
  
  // --- CONTEXT ---
  const contextDetails: ContextMVPDetails = {
    winningTeamPoints: 0,
    momPoints: 0,
    subtotal: 0,
  };
  
  if (matchResult === 'won') {
    // Winning team bonus applied to subtotal later
    contextDetails.winningTeamPoints = (battingDetails.subtotal + bowlingDetails.subtotal + fieldingDetails.subtotal) * (weights.winningTeamMultiplier - 1);
  }
  
  if (isOfficialMOM) {
    contextDetails.momPoints = weights.momBonus;
  }
  
  contextDetails.subtotal = contextDetails.winningTeamPoints + contextDetails.momPoints;
  
  // --- TOTAL ---
  const baseTotal = battingDetails.subtotal + bowlingDetails.subtotal + fieldingDetails.subtotal;
  const total = baseTotal + contextDetails.subtotal;
  
  return {
    battingPoints: battingDetails.subtotal,
    bowlingPoints: bowlingDetails.subtotal,
    fieldingPoints: fieldingDetails.subtotal,
    contextPoints: contextDetails.subtotal,
    total: Number(total.toFixed(2)),
    details: {
      batting: battingDetails,
      bowling: bowlingDetails,
      fielding: fieldingDetails,
      context: contextDetails,
    },
  };
}

/**
 * Calculate MVP for all players in a match and determine the winner
 */
export function calculateMatchMVP(
  performances: PlayerMatchPerformance[],
  winningTeamId: string,
  format: 'T20' | 'ODI' | 'TEST' | 'T10' | 'HUNDRED' = 'T20'
): MVPAward | null {
  if (performances.length === 0) return null;
  
  const weights = format === 'T20' ? T20_MVP_WEIGHTS : 
                  format === 'ODI' ? ODI_MVP_WEIGHTS : 
                  DEFAULT_MVP_WEIGHTS;
  
  const mvpResults = performances.map(p => {
    const isWinningTeam = p.teamId === winningTeamId;
    const breakdown = calculateMVP(p, isWinningTeam ? 'won' : 'lost', false, format, weights);
    return { player: p, breakdown };
  });
  
  // Sort by total points descending
  mvpResults.sort((a, b) => b.breakdown.total - a.breakdown.total);
  
  const winner = mvpResults[0];
  if (!winner) return null;
  
  // Generate stat highlights string
  const batting = winner.player.batting;
  const bowling = winner.player.bowling;
  const highlights = [
    batting ? `${batting.runs}*(${batting.ballsFaced}) ${batting.fours} 4s ${batting.sixes} 6s` : null,
    bowling ? `${bowling.overs}-${bowling.maidens}-${bowling.runsConceded}-${bowling.wickets}` : null,
  ].filter(Boolean).join(' | ');
  
  return {
    playerId: winner.player.playerId,
    playerName: winner.player.playerName,
    teamName: performances.find(p => p.playerId === winner.player.playerId)?.teamId || '',
    points: winner.breakdown.total,
    statHighlights: highlights,
    breakdown: {
      battingPoints: winner.breakdown.battingPoints,
      bowlingPoints: winner.breakdown.bowlingPoints,
      fieldingPoints: winner.breakdown.fieldingPoints,
    },
  };
}

/**
 * Calculate MVP directly from ball events (real-time during match)
 */
export function calculateLiveMVP(
  ballEvents: BallEvent[],
  playerIds: string[],
  currentInnings: 1 | 2
): Record<string, number> {
  // Simplified live MVP - just accumulate basic stats
  const stats: Record<string, { runs: number; balls: number; fours: number; sixes: number; wickets: number; dots: number; catches: number }> = {};
  
  playerIds.forEach(id => {
    stats[id] = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, dots: 0, catches: 0 };
  });
  
  ballEvents.forEach((ball, _index) => {
    if (ball.inningsNumber !== currentInnings) return;
    
    // Batting
    const strikerStats = stats[ball.strikerId];
    if (strikerStats) {
      strikerStats.runs += ball.runsBat;
      if (ball.isLegalDelivery) strikerStats.balls += 1;
      if (ball.isBoundaryFour) strikerStats.fours += 1;
      if (ball.isBoundarySix) strikerStats.sixes += 1;
      if (ball.isLegalDelivery && ball.totalRuns === 0 && !ball.isWicket) strikerStats.dots += 1;
    }
    
    // Bowling
    const bowlerStats = stats[ball.bowlerId];
    if (bowlerStats && ball.isLegalDelivery) {
      if (ball.isWicket) bowlerStats.wickets += 1;
      if (ball.totalRuns === 0) bowlerStats.dots += 1;
    }
    
    // Fielding (catch/run out from dismissal)
    if (ball.dismissal?.fielderId) {
      const fielderStats = stats[ball.dismissal.fielderId];
      if (fielderStats) {
        if (ball.dismissal.type === 'caught') {
          fielderStats.catches += 1;
        }
        if (ball.dismissal.type === 'run_out') {
          fielderStats.catches += 1; // Count as fielding contribution
        }
      }
    }
  });
  
  // Quick MVP calculation from live stats
  const mvp: Record<string, number> = {};
  Object.entries(stats).forEach(([id, s]) => {
    let points = 0;
    points += s.runs * 1.0;
    points += s.fours * 0.5;
    points += s.sixes * 1.0;
    points += s.wickets * 15.0;
    points += s.catches * 4.0;
    points += s.dots * 0.3;
    mvp[id] = Number(points.toFixed(1));
  });
  
  return mvp;
}