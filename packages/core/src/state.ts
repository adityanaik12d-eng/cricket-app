import type { InningsState, MatchConfig, MatchResult, MatchState, MatchStatus, TeamKey, TossEvent } from './types.js'

export function emptyInnings(index: number, config: MatchConfig, toss: TossEvent | null): InningsState {
  let battingTeamId: string
  let bowlingTeamId: string
  if (toss) {
    if (toss.winnerDecision === 'BAT') {
      battingTeamId = toss.winnerTeamId
      bowlingTeamId = toss.winnerTeamId === config.teamAId ? config.teamBId : config.teamAId
    } else {
      bowlingTeamId = toss.winnerTeamId
      battingTeamId = toss.winnerTeamId === config.teamAId ? config.teamBId : config.teamAId
    }
  } else {
    battingTeamId = index === 0 ? config.teamAId : config.teamBId
    bowlingTeamId = index === 0 ? config.teamBId : config.teamAId
  }
  return {
    index,
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: 0,
    freeHit: false,
    strikerId: null,
    nonStrikerId: null,
    currentBowlerId: null,
    lastOverBowlerId: null,
    batters: {},
    bowlers: {},
    battingOrder: [],
    declared: false,
    closed: false,
  }
}

export function emptyState(config: MatchConfig): MatchState {
  return {
    config,
    status: 'CREATED' as MatchStatus,
    toss: null,
    innings: [],
    overrideResult: null,
    lastSeq: 0,
    eventCount: 0,
  }
}

export function currentInnings(state: MatchState): InningsState | null {
  return state.innings[state.innings.length - 1] ?? null
}

export function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state))
}