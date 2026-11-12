import { useMemo, useState } from 'react'
import { calculateNRR, formatNRR, oversToDecimal, type StandingRow } from './standings'

interface Props {
  rows: StandingRow[]
  quotaOvers: number
}

export function SmartNRRCalculator({ rows, quotaOvers }: Props) {
  const [teamId, setTeamId] = useState(rows[0]?.teamId ?? '')
  const [opponentId, setOpponentId] = useState(rows[1]?.teamId ?? '')
  const [scenario, setScenario] = useState<'bat_first'|'chase'>('bat_first')
  const [marginRuns, setMarginRuns] = useState(20)
  const [chaseOvers, setChaseOvers] = useState(Math.max(1, quotaOvers - 2))

  const selected = rows.find(r => r.teamId === teamId)
  const projection = useMemo(() => {
    if (!selected) return null
    // Simplified what-if: assume opponent scores 140 if batting first; adjust via margin
    const assumedOppRuns = 140
    let addScored = 0, addFaced = quotaOvers, addConceded = 0, addBowled = quotaOvers
    if (scenario === 'bat_first') {
      addScored = assumedOppRuns + marginRuns
      addConceded = assumedOppRuns
      addFaced = quotaOvers
      addBowled = quotaOvers // assume bowled out or full
    } else {
      const target = assumedOppRuns + 1
      addScored = target
      addConceded = assumedOppRuns
      addFaced = Math.max(0.1, chaseOvers)
      addBowled = quotaOvers
    }
    const nrr = calculateNRR({
      runsScored: selected.runsScored + addScored,
      oversFaced: selected.oversFaced + addFaced,
      runsConceded: selected.runsConceded + addConceded,
      oversBowled: selected.oversBowled + addBowled,
    })
    return { nrr, points: selected.points + 2 }
  }, [selected, scenario, marginRuns, chaseOvers, quotaOvers])

  if (rows.length < 2) return <p className="muted">Add at least 2 teams to use the NRR calculator.</p>
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Smart NRR Calculator (MVP)</h3>
      <div className="field-row">
        <label>Team
          <select value={teamId} onChange={(e)=>setTeamId(e.target.value)}>
            {rows.map(r => <option key={r.teamId} value={r.teamId}>{r.teamName}</option>)}
          </select>
        </label>
        <label>Opponent
          <select value={opponentId} onChange={(e)=>setOpponentId(e.target.value)}>
            {rows.filter(r=>r.teamId!==teamId).map(r => <option key={r.teamId} value={r.teamId}>{r.teamName}</option>)}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label>Scenario
          <select value={scenario} onChange={(e)=>setScenario(e.target.value as any)}>
            <option value="bat_first">Bat first & win by runs</option>
            <option value="chase">Chase target in overs</option>
          </select>
        </label>
        {scenario==='bat_first' ? (
          <label>Win by (runs)<input type="number" min={1} value={marginRuns} onChange={(e)=>setMarginRuns(Number(e.target.value)||1)} /></label>
        ) : (
          <label>Chase in (overs)<input type="number" min={0.1} step={0.1} value={chaseOvers} onChange={(e)=>setChaseOvers(Number(e.target.value)||1)} /></label>
        )}
      </div>
      {projection && selected && (
        <div className="dls-result">
          <div>Current: Pts {selected.points}, NRR {formatNRR(selected.nrr)}</div>
          <div><strong>Projected (simplified):</strong> Pts {projection.points}, NRR {formatNRR(projection.nrr)}</div>
          <div className="muted" style={{ fontSize: 12 }}>MVP estimate (assumes baseline opponent score). Refine with actual match scenarios.</div>
        </div>
      )}
    </div>
  )
}
