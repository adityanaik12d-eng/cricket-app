import { useMemo, useState } from 'react'
import { ThemeToggle } from './ui/ThemeToggle'
import { SmartNRRCalculator } from './SmartNRRCalculator'
import { AnimatedCounter } from './ui/AnimatedCounter'
import {
  computeGroupStandings,
  formatNRR,
  type MatchResultInput,
  type TeamInput,
} from './standings'

interface Props {
  onBack: () => void
}

type ResultPick = 'A' | 'B' | 'tie' | 'nr'

const DEFAULT_POINTS = { pointsForWin: 2, pointsForLoss: 0, pointsForTie: 1, pointsForNoResult: 1 }

function newId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function StandingsScreen({ onBack }: Props) {
  const [teams, setTeams] = useState<TeamInput[]>([
    { id: 't1', name: 'Team A' },
    { id: 't2', name: 'Team B' },
  ])
  const [results, setResults] = useState<MatchResultInput[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [oversLimit, setOversLimit] = useState(20)

  const [form, setForm] = useState({
    teamAId: 't1',
    teamBId: 't2',
    result: 'A' as ResultPick,
    aRuns: 150,
    aOvers: 20,
    aAllOut: false,
    bRuns: 140,
    bOvers: 20,
    bAllOut: false,
  })

  const standings = useMemo(
    () => computeGroupStandings(teams, results, DEFAULT_POINTS),
    [teams, results],
  )

  const leader = standings.rows[0]

  function addTeam(): void {
    const name = newTeamName.trim()
    if (!name) return
    const id = `t-${newId()}`
    setTeams((prev) => [...prev, { id, name }])
    setNewTeamName('')
    setForm((f) => ({
      ...f,
      teamAId: f.teamAId || id,
      teamBId: f.teamBId && f.teamBId !== f.teamAId ? f.teamBId : id,
    }))
  }

  function removeTeam(id: string): void {
    setTeams((prev) => prev.filter((t) => t.id !== id))
    setResults((prev) => prev.filter((r) => r.teamAId !== id && r.teamBId !== id))
  }

  function addResult(): void {
    if (!form.teamAId || !form.teamBId || form.teamAId === form.teamBId) return
    const isNR = form.result === 'nr'
    const entry: MatchResultInput = {
      id: newId(),
      teamAId: form.teamAId,
      teamBId: form.teamBId,
      result: form.result,
      oversLimit,
      teamA: isNR ? null : { runs: Number(form.aRuns) || 0, overs: Number(form.aOvers) || 0, allOut: form.aAllOut },
      teamB: isNR ? null : { runs: Number(form.bRuns) || 0, overs: Number(form.bOvers) || 0, allOut: form.bAllOut },
    }
    setResults((prev) => [...prev, entry])
  }

  function removeResult(id?: string): void {
    if (!id) return
    setResults((prev) => prev.filter((r) => r.id !== id))
  }

  function loadDemo(): void {
    const demoTeams: TeamInput[] = [
      { id: 'med', name: 'Medimax UCA' },
      { id: 'jag', name: 'Jaguars' },
      { id: 'blu', name: 'Blue Sentinels XI' },
      { id: 'elv', name: 'Eleven XI' },
    ]
    setTeams(demoTeams)
    setOversLimit(20)
    setResults([
      { id: 'm1', teamAId: 'med', teamBId: 'jag', result: 'A', oversLimit: 20, teamA: { runs: 165, overs: 20 }, teamB: { runs: 140, overs: 20 } },
      { id: 'm2', teamAId: 'blu', teamBId: 'elv', result: 'A', oversLimit: 20, teamA: { runs: 189, overs: 20 }, teamB: { runs: 102, overs: 15.4, allOut: true } },
      { id: 'm3', teamAId: 'med', teamBId: 'blu', result: 'A', oversLimit: 20, teamA: { runs: 172, overs: 19.2 }, teamB: { runs: 168, overs: 20 } },
      { id: 'm4', teamAId: 'jag', teamBId: 'elv', result: 'A', oversLimit: 20, teamA: { runs: 155, overs: 18.1 }, teamB: { runs: 154, overs: 20 } },
    ])
    setForm((f) => ({ ...f, teamAId: 'med', teamBId: 'jag' }))
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Points Table</h1>
        <div className="topbar-actions">
          <ThemeToggle />
          <button className="btn ghost" onClick={onBack}>Back</button>
        </div>
      </header>

      <main className="card setup-card standings-screen ms-reveal">
        <p className="muted" style={{ marginTop: 0 }}>
          Standalone MVP: add teams &amp; match results to compute standings (Win=2, Tie=1, NR=1, Loss=0) with NRR.
          All-out innings use full quota overs for NRR.
        </p>

        <div className="ms-stat-grid" aria-label="Standings summary">
          <div className="ms-stat-card">
            <div className="ms-stat-label">Teams</div>
            <div className="ms-stat-value"><AnimatedCounter value={teams.length} /></div>
            <div className="ms-stat-sub">in group</div>
          </div>
          <div className="ms-stat-card">
            <div className="ms-stat-label">Matches</div>
            <div className="ms-stat-value"><AnimatedCounter value={results.length} /></div>
            <div className="ms-stat-sub">results added</div>
          </div>
          <div className="ms-stat-card">
            <div className="ms-stat-label">Leader</div>
            <div className="ms-stat-value" style={{ fontSize: '1.05rem', lineHeight: 1.2 }}>{leader?.teamName ?? '—'}</div>
            <div className="ms-stat-sub">{leader ? `${leader.points} pts · NRR ${formatNRR(leader.nrr)}` : 'Add results'}</div>
          </div>
        </div>

        <div className="standings-actions">
          <button className="btn ghost" type="button" onClick={loadDemo}>Load demo</button>
        </div>

        <section className="standings-section">
          <h3>Teams</h3>
          <div className="form-field add-row">
            <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" />
            <button className="btn" type="button" onClick={addTeam} disabled={!newTeamName.trim()}>Add</button>
          </div>
          <div className="chip-row">
            {teams.map((t) => (
              <span key={t.id} className="chip removable">
                {t.name}
                <button className="chip-remove" type="button" onClick={() => removeTeam(t.id)} aria-label="remove team">×</button>
              </span>
            ))}
          </div>
        </section>

        <section className="standings-section">
          <h3>Add match result</h3>
          <div className="form-field field-row">
            <label className="form-field">
              <span className="form-label">Quota overs</span>
              <input type="number" min={1} max={90} value={oversLimit} onChange={(e) => setOversLimit(Number(e.target.value) || 20)} />
            </label>
          </div>
          <div className="field-row">
            <label className="form-field">
              <span className="form-label">Team A</span>
              <select value={form.teamAId} onChange={(e) => setForm({ ...form, teamAId: e.target.value })}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Team B</span>
              <select value={form.teamBId} onChange={(e) => setForm({ ...form, teamBId: e.target.value })}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
          <div className="form-field field-row">
            <label className="form-field">
              <span className="form-label">Result</span>
              <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as ResultPick })}>
                <option value="A">Team A won</option>
                <option value="B">Team B won</option>
                <option value="tie">Tie</option>
                <option value="nr">No Result</option>
              </select>
            </label>
          </div>
          {form.result !== 'nr' && (
            <>
              <div className="standings-subhead">Team A innings</div>
              <div className="field-row">
                <label className="form-field">
                  <span className="form-label">Runs</span>
                  <input type="number" min={0} value={form.aRuns} onChange={(e) => setForm({ ...form, aRuns: Number(e.target.value) })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Overs</span>
                  <input type="number" min={0} step={0.1} value={form.aOvers} onChange={(e) => setForm({ ...form, aOvers: Number(e.target.value) })} />
                </label>
                <label className="checkbox-inline"><input type="checkbox" checked={form.aAllOut} onChange={(e) => setForm({ ...form, aAllOut: e.target.checked })} /> All out</label>
              </div>
              <div className="standings-subhead">Team B innings</div>
              <div className="field-row">
                <label className="form-field">
                  <span className="form-label">Runs</span>
                  <input type="number" min={0} value={form.bRuns} onChange={(e) => setForm({ ...form, bRuns: Number(e.target.value) })} />
                </label>
                <label className="form-field">
                  <span className="form-label">Overs</span>
                  <input type="number" min={0} step={0.1} value={form.bOvers} onChange={(e) => setForm({ ...form, bOvers: Number(e.target.value) })} />
                </label>
                <label className="checkbox-inline"><input type="checkbox" checked={form.bAllOut} onChange={(e) => setForm({ ...form, bAllOut: e.target.checked })} /> All out</label>
              </div>
            </>
          )}
          <button className="btn accent wide" type="button" onClick={addResult} disabled={teams.length < 2 || form.teamAId === form.teamBId}>
            Add result
          </button>
        </section>

        {results.length > 0 && (
          <section className="standings-section">
            <h3>Match results ({results.length})</h3>
            <ul className="standings-results">
              {results.map((r) => (
                <li key={r.id} className="standings-result-row">
                  <span>{teamName(r.teamAId)} vs {teamName(r.teamBId)} — {r.result === 'nr' ? 'NR' : r.result === 'tie' ? 'Tie' : `${teamName(r.result === 'A' ? r.teamAId : r.teamBId)} won`}</span>
                  <button className="btn ghost" type="button" onClick={() => removeResult(r.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="standings-section">
          <h3>Points Table</h3>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Team</th><th className="num">M</th><th className="num">W</th><th className="num">L</th><th className="num">T</th><th className="num">NR</th><th className="num">Pts</th><th className="num">NRR</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((row) => (
                  <tr key={row.teamId}>
                    <td className="pt-team">{row.teamName}</td>
                    <td className="num">{row.played}</td>
                    <td className="num">{row.won}</td>
                    <td className="num">{row.lost}</td>
                    <td className="num">{row.tied}</td>
                    <td className="num">{row.noResult}</td>
                    <td className="num pt-pts">{row.points}</td>
                    <td className={`num ${row.nrr >= 0 ? 'pt-nrr pos' : 'pt-nrr neg'}`}>{formatNRR(row.nrr)}</td>
                  </tr>
                ))}
                {standings.rows.length === 0 && (
                  <tr><td colSpan={8} className="muted">Add teams to see standings.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <SmartNRRCalculator rows={standings.rows} quotaOvers={oversLimit} />
        </section>
      </main>
    </div>
  )
}
