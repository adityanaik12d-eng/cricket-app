/** MVP / Player of the Match (best-effort weighted points). */
export interface PlayerMatchImpact {
  playerId: string
  playerName: string
  teamName?: string
  runs?: number
  balls?: number
  fours?: number
  sixes?: number
  notOut?: boolean
  wickets?: number
  overs?: number
  runsConceded?: number
  maidens?: number
  catches?: number
  stumpings?: number
  runOuts?: number
}

export interface MVPCandidate extends PlayerMatchImpact {
  points: number
  breakdown: string[]
}

export function calculateMVPPoints(p: PlayerMatchImpact): MVPCandidate {
  let points = 0
  const breakdown: string[] = []
  const runs = p.runs ?? 0
  const balls = p.balls ?? 0
  const sr = balls > 0 ? (runs / balls) * 100 : 0
  if (runs) { points += runs * 1; breakdown.push(`Runs ${runs} (+${runs})`) }
  if ((p.fours ?? 0) > 0) { const v = (p.fours ?? 0) * 1; points += v; breakdown.push(`4s +${v}`) }
  if ((p.sixes ?? 0) > 0) { const v = (p.sixes ?? 0) * 2; points += v; breakdown.push(`6s +${v}`) }
  if (p.notOut && runs >= 20) { points += 5; breakdown.push('Not out bonus +5') }
  if (sr >= 150 && runs >= 20) { points += 4; breakdown.push('SR bonus +4') }
  const wkts = p.wickets ?? 0
  if (wkts) { const v = wkts * 20; points += v; breakdown.push(`Wkts ${wkts} (+${v})`) }
  if ((p.maidens ?? 0) > 0) { const v = (p.maidens ?? 0) * 4; points += v; breakdown.push(`Maidens +${v}`) }
  const eco = (p.overs ?? 0) > 0 ? (p.runsConceded ?? 0) / (p.overs ?? 1) : 999
  if ((p.overs ?? 0) >= 2 && eco <= 6 && wkts > 0) { points += 4; breakdown.push('Economy bonus +4') }
  if ((p.catches ?? 0) > 0) { const v = (p.catches ?? 0) * 10; points += v; breakdown.push(`Catches +${v}`) }
  if ((p.stumpings ?? 0) > 0) { const v = (p.stumpings ?? 0) * 12; points += v; breakdown.push(`Stumpings +${v}`) }
  if ((p.runOuts ?? 0) > 0) { const v = (p.runOuts ?? 0) * 10; points += v; breakdown.push(`Run outs +${v}`) }
  return { ...p, points: Math.round(points * 100) / 100, breakdown }
}

export function pickPlayerOfMatch(players: PlayerMatchImpact[]): MVPCandidate | null {
  if (!players.length) return null
  const scored = players.map(calculateMVPPoints).sort((a,b) => b.points - a.points)
  return scored[0] ?? null
}
