import { effectiveEvents, formatOvers, projectScorecard, round2 } from '@cricket-app/core'
import type { MatchEvent } from '@cricket-app/core'
import type { MatchRecord } from './store.ts'

export interface CareerStats {
  matches: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number
  notOuts: number
  wickets: number
  oversBowled: string
  runsConceded: number
  bestBowling: string
  catches: number
  stumpings: number
  runOuts: number
  batting: { innings: number; outCount: number; average: number; strikeRate: number }
  bowling: { innings: number; economy: number; average: number }
  fielding: { dismissals: number }
}

function emptyStats(): CareerStats {
  return {
    matches: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highest: 0,
    notOuts: 0,
    wickets: 0,
    oversBowled: '0.0',
    runsConceded: 0,
    bestBowling: '-',
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    batting: { innings: 0, outCount: 0, average: 0, strikeRate: 0 },
    bowling: { innings: 0, economy: 0, average: 0 },
    fielding: { dismissals: 0 },
  }
}

function isFielderCredit(ev: MatchEvent, playerId: string): 'CAUGHT' | 'STUMPED' | 'RUN_OUT' | null {
  if (ev.type !== 'BALL' || ev.fielderId !== playerId) return null
  if (ev.dismissal === 'CAUGHT') return 'CAUGHT'
  if (ev.dismissal === 'STUMPED') return 'STUMPED'
  if (ev.dismissal === 'RUN_OUT') return 'RUN_OUT'
  return null
}

export function computeCareerStats(records: MatchRecord[], playerId: string): CareerStats {
  const stats = emptyStats()
  let bowledBalls = 0
  let ballsPerOver = 6
  let best: { wickets: number; runs: number } | null = null

  for (const record of records) {
    ballsPerOver = record.config.ballsPerOver || 6
    const inLineup =
      record.config.lineups.A.includes(playerId) || record.config.lineups.B.includes(playerId)
    if (!inLineup) continue
    stats.matches += 1

    const card = projectScorecard(record.state)
    for (const inn of card.innings) {
      const bat = inn.batting.find((b) => b.playerId === playerId)
      if (bat) {
        stats.batting.innings += 1
        stats.runs += bat.runs
        stats.balls += bat.balls
        stats.fours += bat.fours
        stats.sixes += bat.sixes
        if (bat.runs > stats.highest) stats.highest = bat.runs
        if (bat.out) stats.batting.outCount += 1
        else stats.notOuts += 1
      }
      const bowl = inn.bowling.find((b) => b.playerId === playerId)
      if (bowl) {
        stats.bowling.innings += 1
        stats.wickets += bowl.wickets
        stats.runsConceded += bowl.runs
        bowledBalls += bowl.balls
        if (!best || bowl.wickets > best.wickets || (bowl.wickets === best.wickets && bowl.runs < best.runs)) {
          best = { wickets: bowl.wickets, runs: bowl.runs }
        }
      }
    }

    for (const ev of effectiveEvents(record.events)) {
      const credit = isFielderCredit(ev, playerId)
      if (credit === 'CAUGHT') stats.catches += 1
      else if (credit === 'STUMPED') stats.stumpings += 1
      else if (credit === 'RUN_OUT') stats.runOuts += 1
    }
  }

  // formatOvers trims a whole-over count to '0'/'2'; career stats always show
  // the ball component ('0.0', '2.0') to match the API shape.
  stats.oversBowled = bowledBalls > 0 ? formatOvers(bowledBalls, ballsPerOver) : '0.0'
  if (best) stats.bestBowling = `${best.wickets}/${best.runs}`
  stats.batting.average = stats.batting.outCount > 0 ? round2(stats.runs / stats.batting.outCount) : 0
  stats.batting.strikeRate = stats.balls > 0 ? round2((stats.runs * 100) / stats.balls) : 0
  stats.bowling.economy = bowledBalls > 0 ? round2((stats.runsConceded * 6) / bowledBalls) : 0
  stats.bowling.average = stats.wickets > 0 ? round2(stats.runsConceded / stats.wickets) : 0
  stats.fielding.dismissals = stats.catches + stats.stumpings + stats.runOuts
  return stats
}
