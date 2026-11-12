/** Leaderboard aggregation MVP. */
export interface BattingEntry {
  playerId: string
  playerName: string
  teamName: string
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  notOuts: number
  highest: number
}

export interface BowlingEntry {
  playerId: string
  playerName: string
  teamName: string
  innings: number
  wickets: number
  runsConceded: number
  overs: number
  maidens: number
}

export interface LeaderboardStatInput {
  playerId: string
  playerName: string
  teamName: string
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  notOuts: number
  highest: number
  wickets: number
  runsConceded: number
  overs: number
  maidens: number
}

const empty = (p: LeaderboardStatInput): LeaderboardStatInput => ({ ...p })

export function aggregateLeaderboard(entries: LeaderboardStatInput[]): { batting: BattingEntry[]; bowling: BowlingEntry[] } {
  const map = new Map<string, LeaderboardStatInput>()
  for (const e of entries) {
    const prev = map.get(e.playerId)
    if (!prev) {
      map.set(e.playerId, empty(e))
    } else {
      prev.innings += e.innings
      prev.runs += e.runs
      prev.balls += e.balls
      prev.fours += e.fours
      prev.sixes += e.sixes
      prev.notOuts += e.notOuts
      prev.wickets += e.wickets
      prev.runsConceded += e.runsConceded
      prev.overs += e.overs
      prev.maidens += e.maidens
      prev.highest = Math.max(prev.highest, e.highest)
    }
  }
  const all = Array.from(map.values())
  const batting: BattingEntry[] = all
    .filter(p => p.innings > 0)
    .map(p => ({ playerId: p.playerId, playerName: p.playerName, teamName: p.teamName, innings: p.innings, runs: p.runs, balls: p.balls, fours: p.fours, sixes: p.sixes, notOuts: p.notOuts, highest: p.highest }))
    .sort((a,b) => b.runs - a.runs)
  const bowling: BowlingEntry[] = all
    .filter(p => p.overs > 0 || p.wickets > 0)
    .map(p => ({ playerId: p.playerId, playerName: p.playerName, teamName: p.teamName, innings: p.innings, wickets: p.wickets, runsConceded: p.runsConceded, overs: p.overs, maidens: p.maidens }))
    .sort((a,b) => b.wickets - a.wickets)
  return { batting, bowling }
}
