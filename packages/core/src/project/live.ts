import type { LiveScore, MatchState, ThisOverBall } from '../types.js'
import { currentInnings } from '../state.js'
import { chaseTarget } from '../apply.js'
import { ballsToOvers, formatOvers, oversToBalls, round2 } from '../overs.js'

export function projectLiveScore(state: MatchState): LiveScore {
  const inn = currentInnings(state)
  const config = state.config
  const ballsPerOver = config.ballsPerOver
  const totalBalls = oversToBalls(config.oversPerInnings, ballsPerOver)
  const striker = inn && inn.strikerId ? inn.batters[inn.strikerId] ?? null : null
  const nonStriker = inn && inn.nonStrikerId ? inn.batters[inn.nonStrikerId] ?? null : null
  const bowler = inn && inn.currentBowlerId ? inn.bowlers[inn.currentBowlerId] ?? null : null
  const ballsRemaining = inn ? Math.max(0, totalBalls - inn.legalBalls) : totalBalls
  const target = inn ? chaseTarget(state, inn) : null
  const requiredRunRate =
    inn && target !== null && ballsRemaining > 0
      ? round2((target - inn.runs) / (ballsRemaining / ballsPerOver))
      : null
  const over = inn ? Math.floor(inn.legalBalls / ballsPerOver) : 0
  const powerplay = inn !== null && config.powerplayOvers > 0 && over < config.powerplayOvers
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
    target,
    requiredRunRate,
    freeHit: inn ? inn.freeHit : false,
    declared: inn ? inn.declared : false,
    powerplay,
    ballsRemaining,
    thisOver: (inn ? inn.thisOver ?? [] : []) as ThisOverBall[],
    striker,
    nonStriker,
    bowler,
  }
}