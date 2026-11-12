/**
 * Standalone Points Table + NRR computation (MVP).
 * Standard NRR: (runs scored / overs faced) - (runs conceded / overs bowled).
 * If a team is all out, overs for that innings count as full quota for NRR.
 */

export interface StandingsOptions {
  pointsForWin?: number
  pointsForLoss?: number
  pointsForTie?: number
  pointsForNoResult?: number
  nrrDecimalPlaces?: number
}

export type MatchOutcome = 'win' | 'loss' | 'tie' | 'nr'

export interface TeamInput {
  id: string
  name: string
  shortName?: string
}

/** One innings contribution for a team in a match (for NRR). */
export interface InningsNRR {
  runs: number
  /** Overs bowled/faced as decimal cricket notation (e.g. 19.4 = 19 overs 4 balls). */
  overs: number
  balls?: number
  allOut?: boolean
}

/**
 * Match result input for standings.
 * For NR, provide team ids but omit innings/NRR impact as needed.
 */
export interface MatchResultInput {
  id?: string
  teamAId: string
  teamBId: string
  /** 'A' | 'B' | 'tie' | 'nr' */
  result: 'A' | 'B' | 'tie' | 'nr'
  /** Quota overs for the match (used when allOut=true). */
  oversLimit?: number
  teamA: InningsNRR | null
  teamB: InningsNRR | null
}

export interface StandingRow {
  teamId: string
  teamName: string
  teamShortName?: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  nrr: number
  runsScored: number
  oversFaced: number
  runsConceded: number
  oversBowled: number
}

export interface GroupStandings {
  groupName?: string
  rows: StandingRow[]
}

const DEFAULT_OPTIONS: Required<StandingsOptions> = {
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForTie: 1,
  pointsForNoResult: 1,
  nrrDecimalPlaces: 3,
}

/** Convert cricket overs notation (19.4) to decimal overs (19 + 4/6). */
export function oversToDecimal(overs: number): number {
  if (!Number.isFinite(overs) || overs < 0) return 0
  const whole = Math.trunc(overs)
  const balls = Math.round((overs - whole) * 10)
  if (balls < 0 || balls > 5) {
    // If someone passes true decimal overs already, treat as decimal.
    if (balls > 5) return overs
  }
  return whole + balls / 6
}

/** Effective overs for NRR: all out uses full quota. */
export function effectiveOversForNRR(innings: InningsNRR, quotaOvers?: number): number {
  if (innings.allOut && quotaOvers != null && quotaOvers > 0) return quotaOvers
  return oversToDecimal(innings.overs)
}

export function calculateNRR(input: {
  runsScored: number
  oversFaced: number
  runsConceded: number
  oversBowled: number
}): number {
  const { runsScored, oversFaced, runsConceded, oversBowled } = input
  const forRate = oversFaced > 0 ? runsScored / oversFaced : 0
  const againstRate = oversBowled > 0 ? runsConceded / oversBowled : 0
  return forRate - againstRate
}

function round(value: number, places: number): number {
  const p = 10 ** places
  return Math.round((value + Number.EPSILON) * p) / p
}

function emptyRow(team: TeamInput): StandingRow {
  const row: StandingRow = {
    teamId: team.id,
    teamName: team.name,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    nrr: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
  }
  if (team.shortName != null) row.teamShortName = team.shortName
  return row
}

export function computeGroupStandings(
  teams: TeamInput[],
  results: MatchResultInput[],
  opts: StandingsOptions = {},
): GroupStandings {
  const options = { ...DEFAULT_OPTIONS, ...opts }
  const rows = new Map<string, StandingRow>()
  for (const team of teams) rows.set(team.id, emptyRow(team))

  const ensure = (id: string): StandingRow => {
    let row = rows.get(id)
    if (!row) {
      row = emptyRow({ id, name: id })
      rows.set(id, row)
    }
    return row
  }

  for (const m of results) {
    const a = ensure(m.teamAId)
    const b = ensure(m.teamBId)

    if (m.result === 'nr') {
      a.played += 1; b.played += 1
      a.noResult += 1; b.noResult += 1
      a.points += options.pointsForNoResult
      b.points += options.pointsForNoResult
      continue
    }

    a.played += 1; b.played += 1

    if (m.result === 'tie') {
      a.tied += 1; b.tied += 1
      a.points += options.pointsForTie
      b.points += options.pointsForTie
    } else if (m.result === 'A') {
      a.won += 1; b.lost += 1
      a.points += options.pointsForWin
      b.points += options.pointsForLoss
    } else if (m.result === 'B') {
      b.won += 1; a.lost += 1
      b.points += options.pointsForWin
      a.points += options.pointsForLoss
    }

    // NRR contribution (only when innings data present)
    if (m.teamA && m.teamB) {
      const aFaced = effectiveOversForNRR(m.teamA, m.oversLimit)
      const bFaced = effectiveOversForNRR(m.teamB, m.oversLimit)
      a.runsScored += m.teamA.runs
      a.oversFaced += aFaced
      a.runsConceded += m.teamB.runs
      a.oversBowled += bFaced
      b.runsScored += m.teamB.runs
      b.oversFaced += bFaced
      b.runsConceded += m.teamA.runs
      b.oversBowled += aFaced
    }
  }

  const sorted = Array.from(rows.values()).map((r) => ({
    ...r,
    nrr: round(calculateNRR(r), options.nrrDecimalPlaces),
  }))

  sorted.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.nrr !== x.nrr) return y.nrr - x.nrr
    return x.teamName.localeCompare(y.teamName)
  })

  return { rows: sorted }
}

export function formatNRR(nrr: number, places = 3): string {
  const fixed = Math.abs(nrr).toFixed(places)
  return `${nrr >= 0 ? '+' : '-'}${fixed}`
}
