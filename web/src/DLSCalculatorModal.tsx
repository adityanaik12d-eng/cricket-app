import { useEffect, useMemo, useState } from 'react'
import { calculateRevisedTarget, type DLSMethod } from './dls'

interface Props {
  open: boolean
  onClose: () => void
  totalOvers: number
  team1Runs: number
  onApply?: (result: { revisedTarget: number; revisedOvers: number; method: DLSMethod; note: string }) => void
}

export function DLSCalculatorModal({ open, onClose, totalOvers, team1Runs, onApply }: Props) {
  const [method, setMethod] = useState<DLSMethod>('DLS_5_0')
  const [oversLost, setOversLost] = useState(0)
  const [oversAvailable2, setOversAvailable2] = useState(Math.max(1, totalOvers))
  const [manualTarget, setManualTarget] = useState(team1Runs + 1)

  useEffect(() => {
    setOversAvailable2(Math.max(1, totalOvers - oversLost))
  }, [totalOvers, oversLost])

  useEffect(() => {
    setManualTarget(team1Runs + 1)
  }, [team1Runs])

  const result = useMemo(() => {
    try {
      return calculateRevisedTarget({
        method,
        team1Runs,
        totalOvers,
        oversLostFirstInnings: oversLost,
        oversAvailableTeam2: oversAvailable2,
        manualTarget,
      })
    } catch {
      return { revisedTarget: team1Runs + 1, revisedOvers: totalOvers, note: 'Invalid input' }
    }
  }, [method, team1Runs, totalOvers, oversLost, oversAvailable2, manualTarget])

  if (!open) return null
  return (
    <div className="dls-modal-backdrop" role="dialog" aria-modal="true" aria-label="Revise Target">
      <div className="card dls-modal">
        <h3 style={{ marginTop: 0 }}>Revise Target (DLS/VJD)</h3>
        <p className="muted">1st innings: {team1Runs} runs, {totalOvers} overs scheduled.</p>
        <label className="dls-radio"><input type="radio" checked={method==='DLS_5_0'} onChange={()=>setMethod('DLS_5_0')} /> Apply in-built DLS method (MVP simplified)</label>
        <label>Overs available to chasing team
          <input type="number" min={1} max={totalOvers} value={oversAvailable2} onChange={(e)=>setOversAvailable2(Number(e.target.value)||totalOvers)} />
        </label>
        <label className="dls-radio"><input type="radio" checked={method==='VJD' || method==='MANUAL'} onChange={()=>setMethod('VJD')} /> Apply VJD or manual method</label>
        {(method==='VJD' || method==='MANUAL') && (
          <label>Manual revised target
            <input type="number" min={1} value={manualTarget} onChange={(e)=>setManualTarget(Number(e.target.value)||1)} />
          </label>
        )}
        <div className="dls-result">
          <strong>Revised target:</strong> {result.revisedTarget} in {result.revisedOvers} overs
          <div className="muted" style={{ fontSize: 12 }}>{result.note}</div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn accent" type="button" onClick={() => { onApply?.({ ...result, method }); onClose() }}>Ok</button>
        </div>
      </div>
    </div>
  )
}
