import type { LiveScore, MatchState, ThisOverBall } from '../types.js'
import { currentInnings } from '../state.js'
import { ballsToOvers, formatOvers, oversToBalls, round2 } from '../overs.js'

export function projectLiveScore(state: MatchState): LiveScore {
  const inn = currentInnings(state)
  const config = state.config
  const ballsPerOver = config.ballsPerOver
  const totalBalls = oversToBalls(config.oversPerInnings, ballsPerOver)
  const striker = inn && inn.strikerId ? inn.batters[inn.strikerId] ?? null : null
  const nonStriker = inn && inn.nonStrikerId ? inn.batters[inn.nonStrikerId] ?? null : null
  const bowler = inn && inn.currentBowlerId ? inn.bowlers[inn.currentBowlerId] ?? null : null
  return {
    status: state.status,
    inningsIndex: inn ? inn.index : 0,
    battingTeamId: inn ? inn.battingTeamId : null,
    bowlingTeamId: inn ? inn.bowlingTeamId : null,
    runs: inn ? inn.runs : 0,
    wickets: inn ? inn.wickets : 0,
    oversText: inn ? formatOvers(inn.legalBalls, ballsPerOver) : '0',
    oversDecimal: inn ? ballsToOvers(inn.legalBalls, ballsPerOver) : 0,
    runRate: inn && inn.legalBalls > 0 ? round2(inn.runs / (inn.legalBalls / ballsPerOver)) : 0,
    target: null,
    requiredRunRate: null,
    freeHit: inn ? inn.freeHit : false,
    declared: inn ? inn.declared : false,
    powerplay: false,
    ballsRemaining: inn ? Math.max(0, totalBalls - inn.legalBalls) : totalBalls,
    thisOver: [] as ThisOverBall[],
    striker,
    nonStriker,
    bowler,
  }
}