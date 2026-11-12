import { useEffect, useMemo, useState } from 'react'
import { ThemeToggle } from './ui/ThemeToggle'
import { AnimatedCounter } from './ui/AnimatedCounter'
import { calculateRevisedTarget, type DLSMethod } from './dls'

export function DLSScreen({ onBack }: { onBack: () => void }) {
  const [totalOvers, setTotalOvers] = useState(20)
  const [team1Runs, setTeam1Runs] = useState(180)
  const [method, setMethod] = useState<DLSMethod>('DLS_5_0')
  const [oversLost, setOversLost] = useState(0)
  const [oversAvailable2, setOversAvailable2] = useState(20)
  const [manualTarget, setManualTarget] = useState(181)

  function loadDemo(): void {
    // Demo: T20, Team 1 scores 180/20; rain/interruption reduces chase to 15 overs (simplified)
    setMethod('DLS_5_0')
    setTotalOvers(20)
    setTeam1Runs(180)
    setOversLost(5) // effect derives oversAvailable2 = 15
    setManualTarget(181)
  }

  useEffect(() => { setOversAvailable2(Math.max(1, totalOvers - oversLost)) }, [totalOvers, oversLost])
  useEffect(() => { setManualTarget(team1Runs + 1) }, [team1Runs])

  const result = useMemo(() => {
    try {
      return calculateRevisedTarget({ method, team1Runs, totalOvers, oversLostFirstInnings: oversLost, oversAvailableTeam2: oversAvailable2, manualTarget })
    } catch {
      return { revisedTarget: team1Runs + 1, revisedOvers: totalOvers, note: 'Invalid input' }
    }
  }, [method, team1Runs, totalOvers, oversLost, oversAvailable2, manualTarget])

  return (
    <div className="shell">
      <header className="topbar">
        <h1>DLS / Target Revision</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={onBack}>Back</button>
          <ThemeToggle />
        </div>
      </header>
      <main className="card setup-card dls-screen ms-reveal">
        <p className="muted" style={{ marginTop: 0 }}>Best-effort DLS/VJD revision (MVP simplified). For official matches, verify with official DLS tables.</p>
        <div className="ms-stat-grid" aria-label="DLS summary">
          <div className="ms-stat-card"><div className="ms-stat-label">1st Innings</div><div className="ms-stat-value"><AnimatedCounter value={team1Runs} /></div><div className="ms-stat-sub">runs</div></div>
          <div className="ms-stat-card"><div className="ms-stat-label">Target</div><div className="ms-stat-value"><AnimatedCounter value={result.revisedTarget} /></div><div className="ms-stat-sub">in {result.revisedOvers} ov</div></div>
          <div className="ms-stat-card"><div className="ms-stat-label">Method</div><div className="ms-stat-value" style={{ fontSize: '1rem' }}>{method === 'DLS_5_0' ? 'DLS' : method}</div><div className="ms-stat-sub">{oversAvailable2}/{totalOvers} overs avail.</div></div>
        </div>
        <div className="standings-actions">
          <button className="btn ghost" type="button" onClick={loadDemo}>Load demo</button>
        </div>

        <div className="field-row">
          <label>1st innings runs<input type="number" min={0} value={team1Runs} onChange={e=>setTeam1Runs(Number(e.target.value)||0)} /></label>
          <label>Scheduled overs<input type="number" min={1} max={50} value={totalOvers} onChange={e=>setTotalOvers(Number(e.target.value)||20)} /></label>
        </div>

        <label className="dls-radio"><input type="radio" checked={method==='DLS_5_0'} onChange={()=>setMethod('DLS_5_0')} /> <span>Apply in-built DLS method (MVP simplified)</span></label>
        <div className="field-row">
          <label>Overs lost (1st inn / interruption)<input type="number" min={0} max={Math.max(0, totalOvers-1)} value={oversLost} onChange={(e)=>setOversLost(Math.max(0, Number(e.target.value)||0))} /></label>
          <label>Overs available to chasing team<input type="number" min={1} max={totalOvers} value={oversAvailable2} onChange={(e)=>setOversAvailable2(Math.max(1, Number(e.target.value)||totalOvers))} /></label>
        </div>

        <label className="dls-radio"><input type="radio" checked={method==='VJD' || method==='MANUAL'} onChange={()=>setMethod('VJD')} /> <span>Apply VJD or manual method</span></label>
        {(method==='VJD' || method==='MANUAL') && (
          <label>Manual revised target<input type="number" min={1} value={manualTarget} onChange={(e)=>setManualTarget(Math.max(1, Number(e.target.value)||1))} /></label>
        )}

        <div className="dls-result ms-stat-card" style={{ marginTop: 12 }}>
          <strong>Revised target:</strong> <AnimatedCounter value={result.revisedTarget} /> in {result.revisedOvers} overs
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{result.note}</div>
        </div>
      </main>
    </div>
  )
}
