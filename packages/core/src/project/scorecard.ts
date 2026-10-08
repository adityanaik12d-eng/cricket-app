import type {
  BattingCardLine,
  BowlingCardLine,
  InningsCard,
  InningsState,
  MatchState,
  Scorecard,
} from '../types.js'
import { formatOvers, round2 } from '../overs.js'
import { projectResult } from './result.js'

function projectBatting(inn: InningsState): BattingCardLine[] {
  const lines: BattingCardLine[] = []
  inn.battingOrder.forEach((playerId, i) => {
    const b = inn.batters[playerId]
    if (!b) return
    lines.push({
      position: i + 1,
      playerId: b.playerId,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      out: b.out,
      dismissal: b.dismissal,
      isStriker: inn.strikerId === playerId,
      isNonStriker: inn.nonStrikerId === playerId,
    })
  })
  return lines
}

function projectBowling(inn: InningsState, ballsPerOver: number): BowlingCardLine[] {
  return Object.values(inn.bowlers).map((b) => ({
    playerId: b.playerId,
    balls: b.balls,
    oversText: formatOvers(b.balls, ballsPerOver),
    runs: b.runs,
    wickets: b.wickets,
    wides: b.wides,
    noBalls: b.noBalls,
    economy: b.balls > 0 ? round2(b.runs / (b.balls / ballsPerOver)) : 0,
    isCurrentBowler: inn.currentBowlerId === b.playerId,
  }))
}

function projectYetToBat(state: MatchState, inn: InningsState): string[] {
  const key = inn.battingTeamId === state.config.teamAId ? 'A' : 'B'
  const played = new Set(inn.battingOrder)
  return state.config.lineups[key].filter((p) => !played.has(p))
}

function projectInningsCard(state: MatchState, inn: InningsState): InningsCard {
  const ballsPerOver = state.config.ballsPerOver
  return {
    index: inn.index,
    battingTeamId: inn.battingTeamId,
    bowlingTeamId: inn.bowlingTeamId,
    runs: inn.runs,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    oversText: formatOvers(inn.legalBalls, ballsPerOver),
    extras: inn.extras,
    runRate: inn.legalBalls > 0 ? round2(inn.runs / (inn.legalBalls / ballsPerOver)) : 0,
    batting: projectBatting(inn),
    bowling: projectBowling(inn, ballsPerOver),
    yetToBat: projectYetToBat(state, inn),
    declared: inn.declared,
    closed: inn.closed,
  }
}

export function projectScorecard(state: MatchState): Scorecard {
  return {
    status: state.status,
    innings: state.innings.map((inn) => projectInningsCard(state, inn)),
    result: projectResult(state),
  }
}
