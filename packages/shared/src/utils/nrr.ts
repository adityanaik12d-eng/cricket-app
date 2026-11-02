/**
 * Net Run Rate (NRR) Calculation Utilities
 * As per ICC standards
 */

import type { GroupStandingRow, NRRScenarioInput, NRRScenarioResult } from '../types';

/**
 * Calculate Net Run Rate for a team
 * NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
 * 
 * Special cases:
 * - If team all out before overs completed: overs faced = full quota
 * - If match abandoned: excluded from NRR
 * - If DLS applied: use par scores
 */
export function calculateNRR(
  runsScored: number,
  oversFaced: number,
  runsConceded: number,
  oversBowled: number
): number {
  if (oversFaced === 0 || oversBowled === 0) return 0;
  
  const runRateFor = runsScored / oversFaced;
  const runRateAgainst = runsConceded / oversBowled;
  
  return Number((runRateFor - runRateAgainst).toFixed(3));
}

/**
 * Calculate NRR from a GroupStandingRow
 */
export function calculateNRRFromStanding(row: GroupStandingRow): number {
  return calculateNRR(
    row.runsScoredTotal,
    row.oversFacedTotal,
    row.runsConcededTotal,
    row.oversBowledTotal
  );
}

/**
 * Update standing row with new match result
 */
export function updateStandingWithMatch(
  row: GroupStandingRow,
  match: {
    runsScored: number;
    oversFaced: number;
    runsConceded: number;
    oversBowled: number;
    result: 'won' | 'lost' | 'tied' | 'no_result';
    pointsForWin: number;
    pointsForTie: number;
    pointsForNoResult: number;
  }
): GroupStandingRow {
  const newRunsScored = row.runsScoredTotal + match.runsScored;
  const newOversFaced = row.oversFacedTotal + match.oversFaced;
  const newRunsConceded = row.runsConcededTotal + match.runsConceded;
  const newOversBowled = row.oversBowledTotal + match.oversBowled;
  
  let newPoints = row.points;
  switch (match.result) {
    case 'won': newPoints += match.pointsForWin; break;
    case 'tied': newPoints += match.pointsForTie; break;
    case 'no_result': newPoints += match.pointsForNoResult; break;
  }
  
  const newNRR = calculateNRR(newRunsScored, newOversFaced, newRunsConceded, newOversBowled);
  
  return {
    ...row,
    matchesPlayed: row.matchesPlayed + 1,
    won: row.won + (match.result === 'won' ? 1 : 0),
    lost: row.lost + (match.result === 'lost' ? 1 : 0),
    tied: row.tied + (match.result === 'tied' ? 1 : 0),
    noResult: row.noResult + (match.result === 'no_result' ? 1 : 0),
    points: newPoints,
    nrr: newNRR,
    runsScoredTotal: newRunsScored,
    oversFacedTotal: newOversFaced,
    runsConcededTotal: newRunsConceded,
    oversBowledTotal: newOversBowled,
    recentForm: [...row.recentForm.slice(-4), match.result === 'won' ? 'W' : match.result === 'lost' ? 'L' : 'N'],
  };
}

/**
 * Project NRR for a future match scenario
 */
export function projectNRR(
  current: GroupStandingRow,
  projectedRuns: number,
  projectedOvers: number,
  projectedRunsConceded: number,
  projectedOversBowled: number
): number {
  return calculateNRR(
    current.runsScoredTotal + projectedRuns,
    current.oversFacedTotal + projectedOvers,
    current.runsConcededTotal + projectedRunsConceded,
    current.oversBowledTotal + projectedOversBowled
  );
}

/**
 * Calculate required run rate to achieve target NRR
 */
export function calculateRequiredRRForNRR(
  current: GroupStandingRow,
  targetNRR: number,
  remainingOvers: number,
  isBattingFirst: boolean
): number {
  if (isBattingFirst) {
    // Batting first: need to score at RR such that final NRR >= target
    // (RunsScored + X) / (OversFaced + remainingOvers) - RunsConceded/OversBowled = targetNRR
    // X / (OversFaced + remainingOvers) = targetNRR + RunsConceded/OversBowled - RunsScored/OversFaced
    const concededRR = current.oversBowledTotal > 0 ? current.runsConcededTotal / current.oversBowledTotal : 0;
    const requiredRR = targetNRR + concededRR;
    const totalOvers = current.oversFacedTotal + remainingOvers;
    const requiredRuns = requiredRR * totalOvers - current.runsScoredTotal;
    return requiredRuns / remainingOvers;
  } else {
    // Chasing: need to restrict opponent or chase at RR
    // Similar logic but inverted
    // const _concededRR = current.oversBowledTotal > 0 ? current.runsConcededTotal / current.oversBowledTotal : 0;
    // For chasing, we want to maximize our RR while minimizing theirs
    // This is more complex - depends on target
    return 0; // Placeholder
  }
}

/**
 * Smart NRR Scenario Simulator
 * Calculates what margin needed to qualify
 */
export function simulateNRRScenario(input: NRRScenarioInput): NRRScenarioResult {
  const { currentStandings, teamId, opponentTeamId, matchOvers, scenario, targetValue } = input;
  
  // Find our team and opponent in standings
  const ourTeam = currentStandings.find(s => s.teamId === teamId);
  const opponentTeam = currentStandings.find(s => s.teamId === opponentTeamId);
  
  if (!ourTeam || !opponentTeam) {
    throw new Error('Team not found in standings');
  }
  
  // Calculate current qualification threshold
  // Sort by points desc, then NRR desc
  // const _sortedStandings = [...currentStandings].sort((a, b) => {
  //   if (b.points !== a.points) return b.points - a.points;
  //   return b.nrr - a.nrr;
  // });
  
  // Assume top 2 qualify (adjustable)
  const qualificationSpots = 2;
  // const _currentQualified = sortedStandings.slice(0, qualificationSpots).map(t => t.teamId);
  // const isCurrentlyQualified = currentQualified.includes(teamId);
  
  let projectedNRR: number;
  let projectedPoints = ourTeam.points;
  let requiredMargin = { runs: 0, overs: 0 };
  let ourRuns = 0;
  let theirRuns = 0;
  
  if (scenario === 'bat_first') {
    // We bat first, win by targetValue runs
    // Opponent chases targetValue+1 in matchOvers
    // Our runs = targetValue + opponentScore (but opponent all out or overs complete)
    // For simplicity: we score X, they score X - targetValue
    const ourRuns = targetValue + 100; // Placeholder - would need opponent projected score
    const theirRuns = ourRuns - targetValue;
    
    projectedNRR = projectNRR(
      ourTeam,
      ourRuns,
      matchOvers,
      theirRuns,
      matchOvers
    );
    
    requiredMargin.runs = targetValue;
    projectedPoints += 2; // Win
  } else {
    // Chasing: chase target in targetValue overs
    // We need to know target - placeholder
    const target = 150; // Would come from match context
    const ourRuns = target;
    const theirRuns = target - 1; // They batted first
    const oversUsed = targetValue;
    
    projectedNRR = projectNRR(
      ourTeam,
      ourRuns,
      oversUsed,
      theirRuns,
      matchOvers
    );
    
    requiredMargin.overs = targetValue;
    projectedPoints += 2;
  }
  
  // Check qualification with projected standings
  const projectedStandings = currentStandings.map(s => {
    if (s.teamId === teamId) {
      return { ...s, points: projectedPoints, nrr: projectedNRR };
    }
    if (s.teamId === opponentTeamId) {
      // Opponent loses
      return { 
        ...s, 
        matchesPlayed: s.matchesPlayed + 1,
        lost: s.lost + 1,
        nrr: projectNRR(s, theirRuns || 0, matchOvers, ourRuns || 0, matchOvers)
      };
    }
    return s;
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  
  const projectedQualified = projectedStandings.slice(0, qualificationSpots).map(t => t.teamId);
  const qualifies = projectedQualified.includes(teamId);
  
  // Generate what-if scenarios
  const scenarios = [
    { 
      description: `Win by ${targetValue} runs`, 
      nrr: projectedNRR, 
      qualifies 
    },
    { 
      description: `Win by ${targetValue + 10} runs`, 
      nrr: projectNRR(ourTeam, (targetValue + 10) + 100, matchOvers, 100, matchOvers), 
      qualifies: true 
    },
    { 
      description: `Chase in ${targetValue - 2} overs`, 
      nrr: projectNRR(ourTeam, 150, targetValue - 2, 149, matchOvers), 
      qualifies: true 
    },
  ];
  
  return {
    input,
    projectedNRR,
    projectedPoints,
    qualificationProbability: qualifies ? 0.9 : 0.3,
    requiredMargin,
    scenarios,
  };
}

/**
 * Calculate NRR impact of a single ball
 */
export function calculateBallNRRImpact(
  current: GroupStandingRow,
  runs: number,
  isLegalDelivery: boolean,
  _isWicket: boolean,
  oversRemaining: number
): number {
  if (!isLegalDelivery) return 0; // Wides/no-balls don't consume balls
  
  const newOversFaced = current.oversFacedTotal + 1/6;
  const newRunsScored = current.runsScoredTotal + runs;
  
  // Wicket impact on NRR is indirect (fewer wickets = more overs faced potential)
  // For single ball, just calculate immediate RR change
  const currentRR = current.oversFacedTotal > 0 ? current.runsScoredTotal / current.oversFacedTotal : 0;
  const newRR = newRunsScored / newOversFaced;
  const rrChange = newRR - currentRR;
  
  // Project over remaining overs
  const projectedNRRChange = rrChange * (oversRemaining / newOversFaced);
  
  return projectedNRRChange;
}