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

  // Check if this is a super over innings
  const isSuperOver = state.status === 'SUPER_OVER'
  const superOverOvers = config.superOverOvers ?? 1
  const superOverMaxWickets = config.superOverMaxWickets ?? 2
  const oversForThisInnings = isSuperOver ? superOverOvers : config.oversPerInnings
  const totalBallsForInnings = oversToBalls(oversForThisInnings, ballsPerOver)
  const ballsRemaining = inn ? Math.max(0, totalBallsForInnings - inn.legalBalls) : totalBallsForInnings

  // Calculate target for super over
  let target = inn ? chaseTarget(state, inn) : null
  if (isSuperOver && inn && inn.index >= config.inningsCount) {
    // This is a super over innings
    const superOverInnings = state.innings.filter((i, idx) => idx >= config.inningsCount)
    const firstSuperOverInnings = superOverInnings[0]
    if (firstSuperOverInnings && inn.index > firstSuperOverInnings.index) {
      // Second super over innings - target is first innings runs + 1
      target = firstSuperOverInnings.runs + 1
    }
  }

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