import type { BallEvent, MatchConfig, MatchEvent } from '../types.js'
import { deliveryRuns, effectiveEvents } from '../apply.js'
import { isLegalDelivery } from '../validate.js'

/** Boundary shots scored off the bat, counted per over. */
export interface BoundaryCount {
  ones: number
  twos: number
  threes: number
  fours: number
  sixes: number
}

/** One over of one innings, aggregated for charting. */
export interface OverChart {
  /** 0-based over index, as stored on the delivery. */
  over: number
  /** 1-based over number, the way an over is spoken. */
  overNumber: number
  /** e.g. "Over 3". */
  label: string
  /** Runs added in this over, extras included. */
  runs: number
  wickets: number
  /** Legal deliveries only — wides and no-balls do not count. */
  legalBalls: number
  cumulativeRuns: number
  cumulativeWickets: number
  /** Cumulative run rate at the end of this over. */
  runRate: number
  boundaries: BoundaryCount
}

/** Everything the charts need about one innings. */
export interface InningsChart {
  innings: number
  battingTeamId: string | null
  bowlingTeamId: string | null
  overs: OverChart[]
  runs: number
  wickets: number
  legalBalls: number
  /** Runs per over at the end of the innings. */
  runRate: number
  /** Overs and balls bowled, e.g. "4.2". */
  oversText: string
}

/** Headline numbers for one innings. */
export interface InningsSummary {
  innings: number
  runs: number
  wickets: number
  legalBalls: number
  oversText: string
  runRate: number
  strikeRate: number
  boundaries: BoundaryCount
  /** The over that yielded the most runs. */
  bestOver: OverChart | null
}

/** One point of the worm chart: the score after an over. */
export interface WormPoint {
  over: number
  overNumber: number
  label: string
  runs: number
  wickets: number
}

/** One line of the worm chart — one per innings. */
export interface WormSeries {
  innings: number
  battingTeamId: string | null
  points: WormPoint[]
}

/** One bar of the Manhattan chart — one over of one innings. */
export interface ManhattanBar {
  over: number
  overNumber: number
  label: string
  runs: number
  boundaries: BoundaryCount
}

/** One set of Manhattan bars — one per innings. */
export interface ManhattanSeries {
  innings: number
  battingTeamId: string | null
  bars: ManhattanBar[]
}

/** One reading of the run rate. */
export interface RunRatePoint {
  over: number
  overNumber: number
  label: string
  runRate: number
  /** Runs needed per over to win — only set while the chase is on. */
  requiredRate: number | null
}

/** One run-rate line — one per innings. */
export interface RunRateSeries {
  innings: number
  battingTeamId: string | null
  points: RunRatePoint[]
}

function emptyBoundaries(): BoundaryCount {
  return { ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 }
}

/** Only runs off the bat count as boundaries — a leg bye is not a four. */
function addBoundary(counts: BoundaryCount, event: BallEvent): void {
  if (event.extras !== 'NONE') return
  switch (event.runs) {
    case 1:
      counts.ones += 1
      break
    case 2:
      counts.twos += 1
      break
    case 3:
      counts.threes += 1
      break
    case 4:
      counts.fours += 1
      break
    case 6:
      counts.sixes += 1
      break
    default:
      break
  }
}

function teamKeyForPlayer(config: MatchConfig, playerId: string): 'A' | 'B' | null {
  if (config.lineups.A.includes(playerId)) return 'A'
  if (config.lineups.B.includes(playerId)) return 'B'
  return null
}

function teamId(config: MatchConfig, key: 'A' | 'B' | null): string | null {
  if (key === 'A') return config.teamAId
  if (key === 'B') return config.teamBId
  return null
}

function runRateFor(runs: number, legalBalls: number, ballsPerOver: number): number {
  if (legalBalls <= 0) return 0
  return runs / (legalBalls / ballsPerOver)
}

interface RawOver {
  over: number
  runs: number
  wickets: number
  legalBalls: number
  boundaries: BoundaryCount
}

interface RawInnings {
  innings: number
  battingTeamId: string | null
  bowlingTeamId: string | null
  overs: RawOver[]
}

/**
 * Splits the delivery log into innings and aggregates each over.
 *
 * Corrections are honoured (superseded deliveries are replaced, not repeated).
 * Innings are split by the same proven rule as the commentary and timeline
 * projections: whenever the (over, ball) address regresses, a new innings has
 * begun. This copes with wides and no-balls (which do not advance the ball
 * counter) and with the second innings restarting at 0.0.
 *
 * Penalty runs are not included: the charts are built from overs, so a penalty
 * would not belong to any bar or point.
 */
export function projectInningsTimeline(config: MatchConfig, events: MatchEvent[]): InningsChart[] {
  const raw: RawInnings[] = []
  let innings = 0
  let lastOver: number | null = null
  let lastBall = -1
  let currentInnings: RawInnings | null = null
  let currentOver: RawOver | null = null

  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue

    if (lastOver !== null && (event.over < lastOver || (event.over === lastOver && event.ball < lastBall))) {
      // The address regressed: a new innings has begun.
      innings += 1
      lastOver = null
      currentInnings = null
      currentOver = null
    }

    if (!currentInnings) {
      const batKey = teamKeyForPlayer(config, event.batterId)
      const bowlKey = batKey === 'A' ? 'B' : batKey === 'B' ? 'A' : null
      currentInnings = {
        innings,
        battingTeamId: teamId(config, batKey),
        bowlingTeamId: teamId(config, bowlKey),
        overs: [],
      }
      raw.push(currentInnings)
    }

    if (lastOver === null || event.over !== lastOver) {
      currentOver = { over: event.over, runs: 0, wickets: 0, legalBalls: 0, boundaries: emptyBoundaries() }
      currentInnings.overs.push(currentOver)
      lastOver = event.over
    }
    if (!currentOver) continue

    lastBall = event.ball
    currentOver.runs += deliveryRuns(event, config)
    if (event.wicket) currentOver.wickets += 1
    if (isLegalDelivery(event.extras)) currentOver.legalBalls += 1
    addBoundary(currentOver.boundaries, event)
  }

  return raw.map((inn) => {
    let cumulativeRuns = 0
    let cumulativeWickets = 0
    let cumulativeLegalBalls = 0
    const overs: OverChart[] = inn.overs.map((o) => {
      cumulativeRuns += o.runs
      cumulativeWickets += o.wickets
      cumulativeLegalBalls += o.legalBalls
      return {
        over: o.over,
        overNumber: o.over + 1,
        label: `Over ${o.over + 1}`,
        runs: o.runs,
        wickets: o.wickets,
        legalBalls: o.legalBalls,
        cumulativeRuns,
        cumulativeWickets,
        runRate: runRateFor(cumulativeRuns, cumulativeLegalBalls, config.ballsPerOver),
        boundaries: o.boundaries,
      }
    })
    return {
      innings: inn.innings,
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      overs,
      runs: cumulativeRuns,
      wickets: cumulativeWickets,
      legalBalls: cumulativeLegalBalls,
      runRate: runRateFor(cumulativeRuns, cumulativeLegalBalls, config.ballsPerOver),
      oversText: `${Math.floor(cumulativeLegalBalls / config.ballsPerOver)}.${cumulativeLegalBalls % config.ballsPerOver}`,
    }
  })
}

/** Headline numbers for one innings: totals, rates and the best over. */
export function summariseInnings(chart: InningsChart): InningsSummary {
  const boundaries = chart.overs.reduce<BoundaryCount>(
    (acc, o) => ({
      ones: acc.ones + o.boundaries.ones,
      twos: acc.twos + o.boundaries.twos,
      threes: acc.threes + o.boundaries.threes,
      fours: acc.fours + o.boundaries.fours,
      sixes: acc.sixes + o.boundaries.sixes,
    }),
    emptyBoundaries(),
  )

  let bestOver: OverChart | null = null
  for (const over of chart.overs) {
    if (!bestOver || over.runs > bestOver.runs) bestOver = over
  }

  return {
    innings: chart.innings,
    runs: chart.runs,
    wickets: chart.wickets,
    legalBalls: chart.legalBalls,
    oversText: chart.oversText,
    runRate: chart.runRate,
    strikeRate: chart.legalBalls > 0 ? (chart.runs / chart.legalBalls) * 100 : 0,
    boundaries,
    bestOver,
  }
}

/** The worm chart: cumulative runs after every over, one line per innings. */
export function projectWorm(charts: InningsChart[]): WormSeries[] {
  return charts.map((c) => ({
    innings: c.innings,
    battingTeamId: c.battingTeamId,
    points: c.overs.map((o) => ({
      over: o.over,
      overNumber: o.overNumber,
      label: o.label,
      runs: o.cumulativeRuns,
      wickets: o.cumulativeWickets,
    })),
  }))
}

/** The Manhattan chart: one bar per over, split by the runs scored in it. */
export function projectManhattan(charts: InningsChart[]): ManhattanSeries[] {
  return charts.map((c) => ({
    innings: c.innings,
    battingTeamId: c.battingTeamId,
    bars: c.overs.map((o) => ({
      over: o.over,
      overNumber: o.overNumber,
      label: o.label,
      runs: o.runs,
      boundaries: o.boundaries,
    })),
  }))
}

/**
 * The run rate after every over, one series per innings. While the second
 * innings is chasing, each point also carries the rate needed to win the
 * target that the first innings set.
 */
export function projectRunRate(config: MatchConfig, charts: InningsChart[]): RunRateSeries[] {
  const firstInnings = charts[0]
  const target = firstInnings ? firstInnings.runs + 1 : null
  return charts.map((c) => {
    let cumulativeLegalBalls = 0
    const points = c.overs.map((o) => {
      cumulativeLegalBalls += o.legalBalls
      let requiredRate: number | null = null
      if (c.innings > 0 && target !== null) {
        const remaining = config.oversPerInnings - cumulativeLegalBalls / config.ballsPerOver
        if (remaining > 0) requiredRate = Math.max(0, target / remaining)
      }
      return { over: o.over, overNumber: o.overNumber, label: o.label, runRate: o.runRate, requiredRate }
    })
    return { innings: c.innings, battingTeamId: c.battingTeamId, points }
  })
}
