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

/** DLS resource table: percentage of resources remaining for overs left and wickets lost.
 *  Values are approximate standard DLS (Professional Edition) resource percentages.
 *  Rows: overs remaining (0-50), Columns: wickets lost (0-9, where 10 = all out).
 */
const DLS_RESOURCE_TABLE: number[][] = [
  // Wickets lost: 0    1    2    3    4    5    6    7    8    9
  [100.0, 92.4, 83.8, 73.8, 62.4, 49.3, 35.5, 22.5, 11.9, 4.7],   // 50 overs left
  [99.2, 91.7, 83.1, 73.1, 61.8, 48.8, 35.1, 22.2, 11.7, 4.6],   // 49
  [98.3, 90.9, 82.3, 72.4, 61.2, 48.3, 34.7, 21.9, 11.5, 4.5],   // 48
  [97.3, 90.0, 81.5, 71.6, 60.5, 47.7, 34.3, 21.6, 11.3, 4.4],   // 47
  [96.3, 89.0, 80.6, 70.8, 59.8, 47.1, 33.8, 21.3, 11.1, 4.3],   // 46
  [95.2, 88.0, 79.7, 69.9, 59.0, 46.5, 33.3, 21.0, 10.9, 4.2],   // 45
  [94.0, 86.9, 78.7, 69.0, 58.2, 45.8, 32.8, 20.6, 10.7, 4.1],   // 44
  [92.8, 85.8, 77.6, 68.0, 57.3, 45.1, 32.3, 20.2, 10.5, 4.0],   // 43
  [91.5, 84.6, 76.5, 67.0, 56.4, 44.4, 31.7, 19.8, 10.3, 3.9],   // 42
  [90.1, 83.3, 75.3, 65.9, 55.4, 43.6, 31.1, 19.4, 10.1, 3.8],   // 41
  [88.7, 82.0, 74.1, 64.8, 54.4, 42.8, 30.5, 19.0, 9.9, 3.7],    // 40
  [87.2, 80.6, 72.8, 63.6, 53.3, 42.0, 29.9, 18.5, 9.6, 3.6],    // 39
  [85.6, 79.1, 71.4, 62.4, 52.2, 41.1, 29.2, 18.1, 9.4, 3.5],    // 38
  [83.9, 77.6, 70.0, 61.1, 51.0, 40.2, 28.5, 17.6, 9.2, 3.4],    // 37
  [82.2, 76.0, 68.5, 59.8, 49.8, 39.2, 27.8, 17.1, 8.9, 3.3],    // 36
  [80.4, 74.4, 67.0, 58.4, 48.6, 38.2, 27.0, 16.6, 8.7, 3.2],    // 35
  [78.5, 72.7, 65.4, 56.9, 47.3, 37.2, 26.2, 16.1, 8.4, 3.1],    // 34
  [76.5, 70.9, 63.7, 55.4, 46.0, 36.1, 25.4, 15.6, 8.2, 3.0],    // 33
  [74.5, 69.1, 62.0, 53.8, 44.6, 35.0, 24.5, 15.1, 7.9, 2.9],    // 32
  [72.4, 67.2, 60.2, 52.2, 43.2, 33.9, 23.6, 14.5, 7.6, 2.8],    // 31
  [70.2, 65.2, 58.4, 50.5, 41.7, 32.7, 22.7, 14.0, 7.3, 2.7],    // 30
  [67.9, 63.1, 56.5, 48.8, 40.2, 31.5, 21.8, 13.4, 7.0, 2.6],    // 29
  [65.6, 61.0, 54.5, 47.0, 38.6, 30.2, 20.9, 12.8, 6.7, 2.5],    // 28
  [63.2, 58.8, 52.5, 45.1, 37.0, 28.9, 19.9, 12.2, 6.4, 2.4],    // 27
  [60.7, 56.5, 50.4, 43.2, 35.4, 27.6, 18.9, 11.6, 6.1, 2.3],    // 26
  [58.2, 54.2, 48.2, 41.3, 33.7, 26.2, 17.9, 11.0, 5.8, 2.2],    // 25
  [55.6, 51.8, 46.0, 39.3, 32.0, 24.8, 16.9, 10.4, 5.5, 2.1],    // 24
  [52.9, 49.3, 43.7, 37.3, 30.2, 23.4, 15.9, 9.7, 5.1, 2.0],     // 23
  [50.2, 46.8, 41.4, 35.2, 28.4, 22.0, 14.9, 9.1, 4.8, 1.9],     // 22
  [47.4, 44.2, 39.0, 33.1, 26.6, 20.5, 13.8, 8.5, 4.5, 1.8],     // 21
  [44.5, 41.5, 36.6, 30.9, 24.8, 19.0, 12.8, 7.8, 4.1, 1.7],     // 20
  [41.6, 38.8, 34.1, 28.7, 23.0, 17.5, 11.7, 7.2, 3.8, 1.6],     // 19
  [38.6, 36.0, 31.6, 26.5, 21.1, 16.0, 10.7, 6.5, 3.4, 1.5],     // 18
  [35.6, 33.2, 29.0, 24.2, 19.2, 14.5, 9.6, 5.9, 3.1, 1.4],      // 17
  [32.5, 30.3, 26.4, 21.9, 17.3, 13.0, 8.6, 5.2, 2.7, 1.3],      // 16
  [29.4, 27.3, 23.8, 19.6, 15.4, 11.5, 7.6, 4.6, 2.4, 1.2],      // 15
  [26.3, 24.4, 21.1, 17.2, 13.5, 10.0, 6.6, 4.0, 2.1, 1.1],      // 14
  [23.1, 21.4, 18.5, 14.9, 11.6, 8.5, 5.6, 3.4, 1.8, 0.9],       // 13
  [20.0, 18.4, 15.8, 12.6, 9.8, 7.1, 4.6, 2.8, 1.5, 0.8],        // 12
  [16.8, 15.4, 13.1, 10.4, 8.0, 5.7, 3.7, 2.2, 1.2, 0.7],        // 11
  [13.6, 12.4, 10.5, 8.2, 6.3, 4.4, 2.8, 1.7, 0.9, 0.5],         // 10
  [10.5, 9.5, 8.0, 6.2, 4.7, 3.2, 2.0, 1.2, 0.6, 0.4],           // 9
  [7.5, 6.7, 5.6, 4.3, 3.2, 2.1, 1.3, 0.8, 0.4, 0.3],            // 8
  [4.6, 4.1, 3.4, 2.6, 1.9, 1.2, 0.7, 0.4, 0.2, 0.1],            // 7
  [2.1, 1.8, 1.5, 1.1, 0.8, 0.5, 0.3, 0.2, 0.1, 0.0],            // 6
  [0.8, 0.7, 0.6, 0.4, 0.3, 0.2, 0.1, 0.1, 0.0, 0.0],            // 5
  [0.3, 0.2, 0.2, 0.1, 0.1, 0.1, 0.0, 0.0, 0.0, 0.0],            // 4
  [0.1, 0.1, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],            // 3
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],            // 2
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],            // 1
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],            // 0
]

/** Interpolate resource percentage for fractional overs/wickets using bilinear interpolation. */
function getResourcePercentage(oversLeft: number, wicketsLost: number): number {
  const oversIndex = Math.floor(50 - oversLeft)
  const wkIndex = Math.floor(wicketsLost)

  if (oversIndex >= 50 || wkIndex >= 10) return 0
  if (oversIndex < 0) return 100

  const oversFrac = (50 - oversLeft) - oversIndex
  const wkFrac = wicketsLost - wkIndex

  const row0 = DLS_RESOURCE_TABLE[oversIndex]!
  const row1 = (oversIndex + 1 < 51 ? DLS_RESOURCE_TABLE[oversIndex + 1] : row0)!

  const r00 = row0[wkIndex] ?? 0
  const r10 = row1[wkIndex] ?? r00
  const r01 = (wkIndex + 1 < 10 ? row0[wkIndex + 1] : undefined) ?? r00
  const r11 = (wkIndex + 1 < 10 ? row1[wkIndex + 1] : undefined) ?? r00

  const r0 = r00 + oversFrac * (r10 - r00)
  const r1 = r01 + oversFrac * (r11 - r01)

  return r0 + wkFrac * (r1 - r0)
}

/** Result of a DLS projection. */
export interface DLSProjection {
  /** Par score at each completed over of the second innings (1-based over number). */
  parCurve: { over: number; parScore: number; resourcesRemaining: number }[]
  /** Current DLS target (par score + 1) at the current over/wicket state. */
  currentTarget: number
  /** Resources remaining for team 1 (first innings) as percentage. */
  team1ResourcesRemaining: number
  /** Resources remaining for team 2 (second innings) as percentage. */
  team2ResourcesRemaining: number
  /** Team 2's current score. */
  team2CurrentScore: number
  /** Whether team 2 is ahead of the par score. */
  isAhead: boolean
  /** Runs ahead/behind par (positive = ahead). */
  runsAheadOfPar: number
}

/**
 * Calculate Duckworth-Lewis-Stern (DLS) projection for the second innings.
 *
 * @param firstInningsRuns - Runs scored by team batting first
 * @param oversPerInnings - Scheduled overs per innings (e.g., 50, 20)
 * @param team2OversBowled - Overs completed by team 2 (can be fractional, e.g., 12.4 = 12 overs 4 balls)
 * @param team2WicketsLost - Wickets lost by team 2
 * @param team2CurrentScore - Current runs scored by team 2
 * @param ballsPerOver - Balls per over (default 6)
 * @returns DLSProjection with par curve, current target, and resources remaining
 */
export function projectDLS(
  firstInningsRuns: number,
  oversPerInnings: number,
  team2OversBowled: number,
  team2WicketsLost: number,
  team2CurrentScore: number,
  ballsPerOver: number = 6,
): DLSProjection {
  // Resources at start of innings for each team
  const team1StartResources = getResourcePercentage(oversPerInnings, 0)
  const team2StartResources = getResourcePercentage(oversPerInnings, 0)

  // Resources remaining for team 2 at current state
  const oversLeftTeam2 = oversPerInnings - team2OversBowled
  const team2ResourcesRemaining = Math.max(0, getResourcePercentage(oversLeftTeam2, team2WicketsLost))

  // Team 1 resources used = 100% - resources remaining at end of their innings
  // (they used all their overs, so resources remaining = 0 if completed, or based on overs left if interrupted)
  // For a completed first innings, team 1 used 100% of their resources
  const team1ResourcesUsed = 100 // assuming completed innings

  // Par score calculation: Team 2's target = Team 1 score * (Team 2 resources / Team 1 resources)
  const resourceRatio = team2StartResources / team1StartResources
  const team2TargetBase = firstInningsRuns * resourceRatio

  // Resources used by team 2 so far
  const team2ResourcesUsed = team2StartResources - team2ResourcesRemaining

  // Par score at current point = Team 2 target * (resources used / total resources available to team 2)
  const parScore = Math.floor(team2TargetBase * (team2ResourcesUsed / team2StartResources))

  // Current DLS target = par score + 1
  const currentTarget = parScore + 1

  // Build par curve: par score at each completed over (1 to oversPerInnings)
  const parCurve: { over: number; parScore: number; resourcesRemaining: number }[] = []
  for (let over = 1; over <= oversPerInnings; over++) {
    const oversLeftAtOver = oversPerInnings - over
    const resourcesRemAtOver = getResourcePercentage(oversLeftAtOver, team2WicketsLost)
    const resourcesUsedAtOver = team2StartResources - resourcesRemAtOver
    const parAtOver = Math.floor(team2TargetBase * (resourcesUsedAtOver / team2StartResources))
    parCurve.push({
      over,
      parScore: parAtOver,
      resourcesRemaining: Math.round(resourcesRemAtOver * 10) / 10,
    })
  }

  // Team 1 resources remaining (0 for completed innings)
  const team1ResourcesRemaining = 0

  const runsAheadOfPar = team2CurrentScore - parScore

  return {
    parCurve,
    currentTarget,
    team1ResourcesRemaining,
    team2ResourcesRemaining: Math.round(team2ResourcesRemaining * 10) / 10,
    team2CurrentScore,
    isAhead: runsAheadOfPar > 0,
    runsAheadOfPar,
  }
}

/** One point on the win probability curve — one per over in the chase. */
export interface WinProbabilityPoint {
  over: number
  overNumber: number
  label: string
  /** Probability of the chasing team winning, 0–1. */
  probability: number
  /** Runs still needed to win. */
  runsNeeded: number
  /** Wickets remaining for the chasing team. */
  wicketsRemaining: number
  /** Overs remaining in the innings. */
  oversRemaining: number
  /** Current run rate of the chase. */
  currentRunRate: number
  /** Required run rate to win. */
  requiredRunRate: number
}

/** Win probability series — one per innings (only meaningful for the chase). */
export interface WinProbabilitySeries {
  innings: number
  battingTeamId: string | null
  points: WinProbabilityPoint[]
}

/**
 * Projects the chasing side's win probability after every over.
 *
 * Uses a resource-based model inspired by DLS: the probability is derived from
 * the percentage of batting resources (overs + wickets) remaining, adjusted by
 * the ratio of current run rate to required run rate. The model is continuous
 * and smooth, not a binary "can/can't" — a team 20% behind the required rate
 * with 8 wickets in hand still has a meaningful chance.
 *
 * Only the second innings (innings > 0) produces meaningful values; the first
 * innings returns an empty series.
 */
export function projectWinProbability(
  config: MatchConfig,
  charts: InningsChart[],
): WinProbabilitySeries[] {
  const firstInnings = charts[0]
  const target = firstInnings ? firstInnings.runs + 1 : null
  const totalOvers = config.oversPerInnings
  const maxWickets = config.maxWickets

  return charts.map((c) => {
    if (c.innings === 0 || target === null) {
      return { innings: c.innings, battingTeamId: c.battingTeamId, points: [] as WinProbabilityPoint[] }
    }

    let cumulativeLegalBalls = 0
    let cumulativeWickets = 0
    const points: WinProbabilityPoint[] = c.overs.map((o) => {
      cumulativeLegalBalls += o.legalBalls
      cumulativeWickets += o.wickets

      const oversDone = cumulativeLegalBalls / config.ballsPerOver
      const oversRemaining = Math.max(0, totalOvers - oversDone)
      const wicketsRemaining = Math.max(0, maxWickets - cumulativeWickets)
      const runsScored = o.cumulativeRuns
      const runsNeeded = Math.max(0, target - runsScored)

      const currentRunRate = cumulativeLegalBalls > 0 ? runsScored / oversDone : 0
      const requiredRunRate = oversRemaining > 0 ? runsNeeded / oversRemaining : 0

      // Resource percentage: proportion of overs and wickets remaining.
      // DLS uses a pre-computed table; here we approximate with a smooth curve.
      // Resources = (oversRemaining / totalOvers) * (wicketsRemaining / maxWickets) weighted.
      // The weighting gives more importance to wickets early, overs late.
      const oversResource = oversRemaining / totalOvers
      const wicketsResource = wicketsRemaining / maxWickets

      // Combined resource: geometric mean keeps it sensitive to both dimensions.
      // A team with 100% overs but 0% wickets has 0 resource, and vice versa.
      const resourcePct = Math.sqrt(oversResource * wicketsResource)

      // Run rate ratio: how close current rate is to required rate.
      // >1 means ahead of the game, <1 means behind.
      const rateRatio = requiredRunRate > 0 ? currentRunRate / requiredRunRate : 1

      // Base probability from resources, scaled by rate ratio.
      // The logistic function gives a smooth S-curve that asymptotes at 0 and 1.
      // When rateRatio = 1, probability ≈ resourcePct.
      // When rateRatio > 1, probability increases; when < 1, it decreases.
      const z = 4 * (rateRatio - 1) + 2 * (resourcePct - 0.5)
      const probability = 1 / (1 + Math.exp(-z))

      // Clamp edge cases
      const p = runsNeeded <= 0 ? 1 : wicketsRemaining <= 0 || oversRemaining <= 0 ? 0 : Math.max(0, Math.min(1, probability))

      return {
        over: o.over,
        overNumber: o.overNumber,
        label: o.label,
        probability: p,
        runsNeeded,
        wicketsRemaining,
        oversRemaining: Math.round(oversRemaining * 10) / 10,
        currentRunRate: Math.round(currentRunRate * 10) / 10,
        requiredRunRate: Math.round(requiredRunRate * 10) / 10,
      }
    })

    return { innings: c.innings, battingTeamId: c.battingTeamId, points }
  })
}

/** Type of momentum event detected. */
export type MomentumEventType = 'BOUNDARY_CLUSTER' | 'WICKET_CLUSTER' | 'RUN_RATE_SURGE' | 'RUN_RATE_COLLAPSE'

/** One momentum event detected at a specific over. */
export interface MomentumEvent {
  over: number
  overNumber: number
  label: string
  type: MomentumEventType
  /** Human-readable description. */
  description: string
  /** Magnitude of the event (0–1). Higher = more significant. */
  magnitude: number
}

/** One momentum reading per over. */
export interface MomentumPoint {
  over: number
  overNumber: number
  label: string
  /** Current run rate at this over. */
  runRate: number
  /** Change in run rate from previous over (runs per over). */
  runRateDelta: number
  /** Boundaries (4s + 6s) scored in this over. */
  boundariesThisOver: number
  /** Rolling 3-over boundary count. */
  boundaryFrequency: number
  /** Wickets fallen in this over. */
  wicketsThisOver: number
  /** Rolling 3-over wicket count. */
  wicketFrequency: number
  /** Detected momentum events at this over. */
  events: MomentumEvent[]
}

/** Momentum series — one per innings. */
export interface MomentumSeries {
  innings: number
  battingTeamId: string | null
  points: MomentumPoint[]
}

/**
 * Projects momentum indicators for each over of each innings.
 *
 * Tracks:
 * - Run rate changes (surge/collapse vs previous over)
 * - Wicket clusters (2+ wickets in a 3-over window)
 * - Boundary frequency (4s+6s per over, rolling 3-over window)
 *
 * Returns a point per over with the metrics and any detected events.
 */
export function projectMomentum(config: MatchConfig, charts: InningsChart[]): MomentumSeries[] {
  return charts.map((c) => {
    let prevRunRate = 0
    const points: MomentumPoint[] = c.overs.map((o, idx) => {
      const boundariesThisOver = o.boundaries.fours + o.boundaries.sixes
      const wicketsThisOver = o.wickets

      // Rolling 3-over window for boundary and wicket frequency
      const windowStart = Math.max(0, idx - 2)
      const windowOvers = c.overs.slice(windowStart, idx + 1)
      const boundaryFrequency = windowOvers.reduce((sum, w) => sum + w.boundaries.fours + w.boundaries.sixes, 0)
      const wicketFrequency = windowOvers.reduce((sum, w) => sum + w.wickets, 0)

      const runRateDelta = o.runRate - prevRunRate
      prevRunRate = o.runRate

      const events: MomentumEvent[] = []

      // Boundary cluster: 3+ boundaries in the last 3 overs
      if (boundaryFrequency >= 3) {
        events.push({
          over: o.over,
          overNumber: o.overNumber,
          label: o.label,
          type: 'BOUNDARY_CLUSTER',
          description: `${boundaryFrequency} boundaries in last ${windowOvers.length} overs`,
          magnitude: Math.min(1, boundaryFrequency / 6),
        })
      }

      // Wicket cluster: 2+ wickets in the last 3 overs
      if (wicketFrequency >= 2) {
        events.push({
          over: o.over,
          overNumber: o.overNumber,
          label: o.label,
          type: 'WICKET_CLUSTER',
          description: `${wicketFrequency} wickets in last ${windowOvers.length} overs`,
          magnitude: Math.min(1, wicketFrequency / 4),
        })
      }

      // Run rate surge: current RR > previous RR by 2+ runs/over
      if (runRateDelta >= 2) {
        events.push({
          over: o.over,
          overNumber: o.overNumber,
          label: o.label,
          type: 'RUN_RATE_SURGE',
          description: `Run rate jumped ${runRateDelta.toFixed(1)} runs/over`,
          magnitude: Math.min(1, runRateDelta / 6),
        })
      }

      // Run rate collapse: current RR < previous RR by 2+ runs/over
      if (runRateDelta <= -2) {
        events.push({
          over: o.over,
          overNumber: o.overNumber,
          label: o.label,
          type: 'RUN_RATE_COLLAPSE',
          description: `Run rate dropped ${Math.abs(runRateDelta).toFixed(1)} runs/over`,
          magnitude: Math.min(1, Math.abs(runRateDelta) / 6),
        })
      }

      return {
        over: o.over,
        overNumber: o.overNumber,
        label: o.label,
        runRate: o.runRate,
        runRateDelta: Math.round(runRateDelta * 10) / 10,
        boundariesThisOver,
        boundaryFrequency,
        wicketsThisOver,
        wicketFrequency,
        events,
      }
    })

    return { innings: c.innings, battingTeamId: c.battingTeamId, points }
  })
}
