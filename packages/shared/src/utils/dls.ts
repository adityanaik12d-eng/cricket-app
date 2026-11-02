/**
 * DLS (Duckworth-Lewis-Stern) & VJD Calculation Utilities
 * 
 * Note: Full DLS 5.0 implementation requires proprietary lookup tables.
 * This provides the interface and a simplified approximation for development.
 * For production, integrate with official DLS library or API.
 */

import type { DLSCalculationInput, DLSMethod } from '../types';

// ============================================
// DLS RESOURCE TABLES (Simplified)
// ============================================

/**
 * Standard DLS resource percentages (simplified approximation)
 * Actual DLS 5.0 uses complex lookup tables based on overs remaining and wickets lost
 * This is a development approximation only
 */
const DLS_RESOURCE_TABLE: Record<number, Record<number, number>> = {
  // overs remaining -> wickets lost -> resource %
  50: { 0: 100.0, 1: 92.4, 2: 83.8, 3: 74.1, 4: 63.5, 5: 52.4, 6: 40.8, 7: 29.4, 8: 18.9, 9: 9.9 },
  40: { 0: 89.3, 1: 82.5, 2: 74.8, 3: 66.1, 4: 56.5, 5: 46.2, 6: 35.7, 7: 25.4, 8: 16.1, 9: 8.2 },
  30: { 0: 75.1, 1: 69.6, 2: 63.1, 3: 55.8, 4: 47.8, 5: 39.2, 6: 30.2, 7: 21.3, 8: 13.3, 9: 6.5 },
  25: { 0: 66.5, 1: 61.6, 2: 55.9, 3: 49.3, 4: 42.2, 5: 34.5, 6: 26.4, 7: 18.5, 8: 11.4, 9: 5.4 },
  20: { 0: 56.6, 1: 52.4, 2: 47.6, 3: 41.9, 4: 35.9, 5: 29.2, 6: 22.1, 7: 15.4, 8: 9.4, 9: 4.3 },
  15: { 0: 44.8, 1: 41.5, 2: 37.7, 3: 33.2, 4: 28.5, 5: 23.0, 6: 17.3, 7: 11.9, 8: 7.1, 9: 3.1 },
  10: { 0: 30.8, 1: 28.6, 2: 25.9, 3: 22.8, 4: 19.5, 5: 15.7, 6: 11.7, 7: 7.9, 8: 4.6, 9: 1.9 },
  5:  { 0: 16.4, 1: 15.2, 2: 13.7, 3: 12.0, 4: 10.3, 5: 8.2, 6: 6.1, 7: 4.1, 8: 2.3, 9: 0.9 },
};

/**
 * VJD resource table (simplified - VJD uses different methodology)
 * VJD tends to be more generous to chasing team
 */
const VJD_RESOURCE_TABLE: Record<number, Record<number, number>> = {
  50: { 0: 100.0, 1: 93.0, 2: 85.0, 3: 76.0, 4: 66.0, 5: 55.0, 6: 43.0, 7: 31.0, 8: 20.0, 9: 10.0 },
  40: { 0: 90.0, 1: 83.5, 2: 76.0, 3: 67.5, 4: 58.0, 5: 48.0, 6: 37.0, 7: 26.0, 8: 17.0, 9: 8.5 },
  30: { 0: 76.0, 1: 70.5, 2: 64.0, 3: 56.5, 4: 48.5, 5: 40.0, 6: 31.0, 7: 22.0, 8: 14.0, 9: 7.0 },
  25: { 0: 67.0, 1: 62.0, 2: 56.5, 3: 50.0, 4: 43.0, 5: 35.5, 6: 27.0, 7: 19.0, 8: 12.0, 9: 5.5 },
  20: { 0: 57.0, 1: 53.0, 2: 48.0, 3: 42.5, 4: 36.5, 5: 30.0, 6: 23.0, 7: 16.0, 8: 10.0, 9: 4.5 },
  15: { 0: 45.0, 1: 42.0, 2: 38.0, 3: 33.5, 4: 29.0, 5: 23.5, 6: 18.0, 7: 12.5, 8: 7.5, 9: 3.5 },
  10: { 0: 31.0, 1: 29.0, 2: 26.5, 3: 23.5, 4: 20.0, 5: 16.0, 6: 12.0, 7: 8.0, 8: 5.0, 9: 2.0 },
  5:  { 0: 16.5, 1: 15.5, 2: 14.0, 3: 12.5, 4: 10.5, 5: 8.5, 6: 6.5, 7: 4.5, 8: 2.5, 9: 1.0 },
};

// ============================================
// CORE CALCULATIONS
// ============================================

function interpolateResource(
  overs1: number, res1: number,
  overs2: number, res2: number,
  targetOvers: number
): number {
  if (overs1 === overs2) return res1;
  const ratio = (targetOvers - overs1) / (overs2 - overs1);
  return res1 + ratio * (res2 - res1);
}

function getExactResource(oversRemaining: number, wicketsLost: number, method: DLSMethod): number {
  const table = method === 'DLS_5_0' ? DLS_RESOURCE_TABLE : VJD_RESOURCE_TABLE;
  const oversKeys = Object.keys(table).map(Number).sort((a, b) => a - b);
  
  // Find bracketing overs
  let lower = oversKeys[0];
  let upper = oversKeys[oversKeys.length - 1];
  
  for (const o of oversKeys) {
    if (o <= oversRemaining) lower = o;
    if (o >= oversRemaining) { upper = o; break; }
  }
  
  const wicketsKey = Math.min(Math.max(wicketsLost, 0), 9);
  
  // lower and upper are guaranteed to be set from oversKeys
  const lowerKey = lower as number;
  const upperKey = upper as number;
  
  if (lowerKey === upperKey) return table[lowerKey]?.[wicketsKey] ?? 0;
  
  const resLower = table[lowerKey]?.[wicketsKey] ?? 0;
  const resUpper = table[upperKey]?.[wicketsKey] ?? 0;
  
  return interpolateResource(lowerKey, resLower, upperKey, resUpper, oversRemaining);
}

// ============================================
// DLS CALCULATION (First Innings Interrupted)
// ============================================

export interface DLSResult {
  method: DLSMethod;
  originalOvers: number;
  oversLost: number;
  revisedOvers: number;
  revisedTarget: number;
  // Intermediate
  resourcesAtStart: number;
  resourcesAtInterruption: number;
  resourcesAfterInterruption: number;
  resourcesLost: number;
  resourcesAvailable: number;
  // Par scores
  parScore?: number;
}

/**
 * Calculate revised target when first innings is interrupted
 * (Team 1 batted, then rain, then Team 2 gets reduced overs)
 */
export function calculateDLSFirstInningsInterruption(
  input: DLSCalculationInput
): DLSResult {
  const { method, oversCompleted, wicketsLost, targetScore, maxOvers, oversLost } = input;
  
  const oversRemainingAtInterruption = maxOvers - oversCompleted;
  const revisedOvers = maxOvers - oversLost;
  
  // Resources at start of innings
  const resourcesAtStart = getExactResource(maxOvers, 0, method);
  
  // Resources at interruption
  const resourcesAtInterruption = getExactResource(oversRemainingAtInterruption, wicketsLost, method);
  
  // Resources after interruption (when play resumes)
  const oversRemainingAfter = revisedOvers - oversCompleted;
  const resourcesAfterInterruption = getExactResource(oversRemainingAfter, wicketsLost, method);
  
  // Resources lost due to interruption
  const resourcesLost = resourcesAtInterruption - resourcesAfterInterruption;
  
  // Resources available for Team 2
  const resourcesAvailable = resourcesAtStart - resourcesLost;
  
  // Revised target calculation
  // Team 2 target = Team 1 score * (Team 2 resources / Team 1 resources)
  // But Team 1 score is not known yet (first innings interrupted)
  // This is the "par score" method
  
  const revisedTarget = Math.round(targetScore * (resourcesAvailable / resourcesAtStart));
  
  return {
    method,
    originalOvers: maxOvers,
    oversLost,
    revisedOvers,
    revisedTarget,
    resourcesAtStart,
    resourcesAtInterruption,
    resourcesAfterInterruption,
    resourcesLost,
    resourcesAvailable,
  };
}

/**
 * Calculate revised target when second innings is interrupted
 * (Team 1 completed, Team 2 batting, rain interrupts)
 */
export function calculateDLSSecondInningsInterruption(
  team1Score: number,
  team1Overs: number,
  team1Wickets: number,
  team2OversCompleted: number,
  team2WicketsLost: number,
  oversLost: number,
  maxOvers: number,
  method: DLSMethod
): DLSResult {
  const team2OversRemaining = maxOvers - team2OversCompleted;
  const revisedOvers = maxOvers - oversLost;
  const team2OversRemainingAfter = revisedOvers - team2OversCompleted;
  
  // Team 1 resources
  const team1Resources = getExactResource(team1Overs, team1Wickets, method);
  
  // Team 2 resources at start
  const team2ResourcesAtStart = getExactResource(maxOvers, 0, method);
  
  // Team 2 resources at interruption
  const team2ResourcesAtInterruption = getExactResource(team2OversRemaining, team2WicketsLost, method);
  
  // Team 2 resources after interruption
  const team2ResourcesAfterInterruption = getExactResource(team2OversRemainingAfter, team2WicketsLost, method);
  
  // Team 2 resources lost
  const team2ResourcesLost = team2ResourcesAtInterruption - team2ResourcesAfterInterruption;
  
  // Team 2 resources available
  const team2ResourcesAvailable = team2ResourcesAtStart - team2ResourcesLost;
  
  // Par score at interruption
  const parScore = Math.floor(team1Score * (team2ResourcesAvailable / team1Resources));
  
  // Revised target (need 1 more than par to win)
  const revisedTarget = parScore + 1;
  
  return {
    method,
    originalOvers: maxOvers,
    oversLost,
    revisedOvers,
    revisedTarget,
    resourcesAtStart: team1Resources,
    resourcesAtInterruption: team2ResourcesAtInterruption,
    resourcesAfterInterruption: team2ResourcesAfterInterruption,
    resourcesLost: team2ResourcesLost,
    resourcesAvailable: team2ResourcesAvailable,
    parScore,
  };
}

// ============================================
// VJD METHOD (Alternative)
// ============================================

/**
 * VJD (V. Jayadevan) method - simplified
 * Used in some Indian domestic tournaments
 * More favorable to chasing team compared to DLS
 */
export function calculateVJD(input: DLSCalculationInput): DLSResult {
  // VJD uses different resource calculations
  // For now, delegate to DLS with VJD table
  return calculateDLSFirstInningsInterruption({ ...input, method: 'VJD' });
}

// ============================================
// PAR SCORE TABLE GENERATION
// ============================================

export interface ParScoreEntry {
  oversCompleted: number;
  wicketsLost: number;
  parScore: number;
  targetToWin: number;
}

export function generateParScoreTable(
  team1Score: number,
  team1Overs: number,
  team1Wickets: number,
  maxOvers: number,
  method: DLSMethod
): ParScoreEntry[] {
  const table: ParScoreEntry[] = [];
  
  for (let overs = 0; overs <= maxOvers; overs += 1) {
    for (let wickets = 0; wickets <= 9; wickets++) {
      const result = calculateDLSSecondInningsInterruption(
        team1Score, team1Overs, team1Wickets,
        overs, wickets,
        maxOvers - overs, // overs lost = remaining
        maxOvers,
        method
      );
      
      table.push({
        oversCompleted: overs,
        wicketsLost: wickets,
        parScore: result.parScore ?? 0,
        targetToWin: result.revisedTarget,
      });
    }
  }
  
  return table;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatDLSResult(result: DLSResult): string {
  return `${result.method}: Target revised to ${result.revisedTarget} in ${result.revisedOvers} overs (${result.oversLost} overs lost)`;
}

export function calculateMaxOversPerBowler(totalOvers: number): number {
  return Math.ceil(totalOvers / 5);
}

export function calculateRevisedMaxOversPerBowler(
  originalOvers: number,
  revisedOvers: number
): number {
  return Math.ceil((revisedOvers / originalOvers) * calculateMaxOversPerBowler(originalOvers));
}

// ============================================
// VALIDATION
// ============================================

export function validateDLSInput(input: DLSCalculationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (input.oversCompleted < 0 || input.oversCompleted > input.maxOvers) {
    errors.push('Overs completed must be between 0 and max overs');
  }
  
  if (input.wicketsLost < 0 || input.wicketsLost > 9) {
    errors.push('Wickets lost must be between 0 and 9');
  }
  
  if (input.oversLost < 0 || input.oversLost > input.maxOvers - input.oversCompleted) {
    errors.push('Overs lost cannot exceed remaining overs');
  }
  
  if (input.targetScore <= 0) {
    errors.push('Target score must be positive');
  }
  
  if (input.maxOvers <= 0) {
    errors.push('Max overs must be positive');
  }
  
  return { valid: errors.length === 0, errors };
}