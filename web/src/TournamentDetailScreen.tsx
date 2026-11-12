import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from './supabase'
import { ThemeToggle } from './ui/ThemeToggle'
import { computeGroupStandings, formatNRR, type MatchResultInput, type TeamInput } from './standings'
import { aggregateLeaderboard, type LeaderboardStatInput } from './leaderboard'
import { SmartNRRCalculator } from './SmartNRRCalculator'

interface Props { tournamentId: string; onBack: () => void }

type Tab = 'info' | 'teams' | 'fixtures' | 'standings' | 'leaderboard'

export function TournamentDetailScreen({ tournamentId, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('standings')
  const [tournament, setTournament] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [fixtures, setFixtures] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamName, setTeamName] = useState('')
  const [saving, setSaving] = useState(false)
  const [fx, setFx] = useState({ team1_id:'', team2_id:'', t1Runs:0, t1Overs:20, t1AllOut:false, t2Runs:0, t2Overs:20, t2AllOut:false, result:'A' as 'A'|'B'|'tie'|'nr', group:'Group A' })
  const [boardEntries, setBoardEntries] = useState<LeaderboardStatInput[]>([])
  const [boardForm, setBoardForm] = useState({ playerName:'', teamName:'', runs:0, balls:0, fours:0, sixes:0, notOuts:0, highest:0, wickets:0, runsConceded:0, overs:0, maidens:0, innings:1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = getSupabase()
      const [t, te, f] = await Promise.all([
        sb.from('tournaments').select('*').eq('id', tournamentId).single(),
        sb.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('created_at'),
        sb.from('tournament_fixtures').select('*').eq('tournament_id', tournamentId).order('created_at'),
      ])
      if (t.error) throw t.error
      setTournament(t.data)
      setTeams(te.data ?? [])
      setFixtures(f.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tournament (apply schema.tournaments.sql?)')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => { void load() }, [load])

  async function addTeam(): Promise<void> {
    if (!teamName.trim()) return
    setSaving(true)
    try {
      const { error: err } = await getSupabase().from('tournament_teams').insert({ tournament_id: tournamentId, name: teamName.trim(), group_name: 'Group A' })
      if (err) throw err
      setTeamName('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to add team') }
    finally { setSaving(false) }
  }

  async function addFixtureResult(): Promise<void> {
    if (!fx.team1_id || !fx.team2_id || fx.team1_id === fx.team2_id) return
    setSaving(true)
    try {
      const oversLimit = tournament?.overs_per_innings ?? 20
      const resultPayload = fx.result === 'nr' ? { type: 'nr' } : {
        type: fx.result,
        team1: { runs: fx.t1Runs, overs: fx.t1Overs, allOut: fx.t1AllOut },
        team2: { runs: fx.t2Runs, overs: fx.t2Overs, allOut: fx.t2AllOut },
        winnerTeamId: fx.result === 'A' ? fx.team1_id : fx.result === 'B' ? fx.team2_id : null,
        oversLimit,
      }
      const t1 = teams.find(t=>t.id===fx.team1_id), t2 = teams.find(t=>t.id===fx.team2_id)
      const { error: err } = await getSupabase().from('tournament_fixtures').insert({
        tournament_id: tournamentId, team1_id: fx.team1_id, team2_id: fx.team2_id,
        team1_name: t1?.name, team2_name: t2?.name, group_name: fx.group, status: 'completed', result: resultPayload,
      })
      if (err) throw err
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to add fixture') }
    finally { setSaving(false) }
  }

  const teamInputs: TeamInput[] = useMemo(() => teams.map(t => ({ id: t.id, name: t.name, shortName: t.short_name ?? undefined })), [teams])
  const matchResults: MatchResultInput[] = useMemo(() => fixtures.filter(f => f.status === 'completed' && f.result).map((f: any) => {
    const r = f.result || {}
    const res = r.type === 'nr' ? 'nr' : r.type === 'tie' ? 'tie' : (r.winnerTeamId === f.team1_id ? 'A' : 'B')
    return {
      id: f.id, teamAId: f.team1_id, teamBId: f.team2_id, result: res, oversLimit: r.oversLimit ?? tournament?.overs_per_innings ?? 20,
      teamA: r.team1 ? { runs: r.team1.runs ?? 0, overs: r.team1.overs ?? 0, allOut: !!r.team1.allOut } : null,
      teamB: r.team2 ? { runs: r.team2.runs ?? 0, overs: r.team2.overs ?? 0, allOut: !!r.team2.allOut } : null,
    } as MatchResultInput
  }), [fixtures, tournament])

  const standings = useMemo(() => computeGroupStandings(teamInputs, matchResults), [teamInputs, matchResults])
  const leaderboard = useMemo(() => aggregateLeaderboard(boardEntries), [boardEntries])

  function addBoardEntry(): void {
    if (!boardForm.playerName.trim()) return
    setBoardEntries(prev => [...prev, { playerId: boardForm.playerName.trim().toLowerCase().replace(/\s+/g,'-'), playerName: boardForm.playerName.trim(), teamName: boardForm.teamName.trim() || 'Team', innings: boardForm.innings, runs: boardForm.runs, balls: boardForm.balls, fours: boardForm.fours, sixes: boardForm.sixes, notOuts: boardForm.notOuts, highest: boardForm.highest, wickets: boardForm.wickets, runsConceded: boardForm.runsConceded, overs: boardForm.overs, maidens: boardForm.maidens }])
    setBoardForm({ playerName:'', teamName: boardForm.teamName, runs:0, balls:0, fours:0, sixes:0, notOuts:0, highest:0, wickets:0, runsConceded:0, overs:0, maidens:0, innings:1 })
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>{tournament?.name ?? 'Tournament'}</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn ghost" onClick={onBack}>Back</button>
          <ThemeToggle />
        </div>
      </header>
      <main className="card setup-card">
        {error && <div className="banner warn">{error}</div>}
        {loading && <p className="muted">Loading…</p>}
        {!loading && (
          <>
            <div className="mode-toggle" style={{ flexWrap:'wrap' }}>
              {(['info','teams','fixtures','standings','leaderboard'] as Tab[]).map(t => (
                <button key={t} type="button" className={tab===t ? 'tab active' : 'tab'} onClick={()=>setTab(t)}>{t}</button>
              ))}
            </div>

            {tab==='info' && (
              <section className="standings-section">
                <p><strong>Category:</strong> {tournament?.category} · <strong>Format:</strong> {tournament?.format} · <strong>Status:</strong> {tournament?.status}</p>
                <p><strong>City:</strong> {tournament?.city ?? '—'} · <strong>Overs:</strong> {tournament?.overs_per_innings ?? 20}</p>
                <p className="muted">Best-effort tournament foundation. Apply <code>supabase/schema.tournaments.sql</code> in Supabase SQL Editor to enable persistence.</p>
              </section>
            )}

            {tab==='teams' && (
              <section className="standings-section">
                <h3>Teams ({teams.length})</h3>
                <div className="add-row">
                  <input value={teamName} onChange={(e)=>setTeamName(e.target.value)} placeholder="Team name" />
                  <button className="btn" type="button" onClick={()=>void addTeam()} disabled={saving||!teamName.trim()}>Add</button>
                </div>
                <div className="chip-row">{teams.map(t => <span key={t.id} className="chip">{t.name}</span>)}</div>
              </section>
            )}

            {tab==='fixtures' && (
              <section className="standings-section">
                <h3>Add completed fixture/result</h3>
                {teams.length < 2 ? <p className="muted">Add at least 2 teams first.</p> : (
                  <>
                    <div className="field-row">
                      <label>Team 1<select value={fx.team1_id} onChange={e=>setFx({...fx,team1_id:e.target.value})}><option value="">Select</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                      <label>Team 2<select value={fx.team2_id} onChange={e=>setFx({...fx,team2_id:e.target.value})}><option value="">Select</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                    </div>
                    <div className="field-row"><label>Result<select value={fx.result} onChange={e=>setFx({...fx,result:e.target.value as any})}><option value="A">Team 1 won</option><option value="B">Team 2 won</option><option value="tie">Tie</option><option value="nr">NR</option></select></label></div>
                    {fx.result!=='nr' && (<>
                      <div className="standings-subhead">Team 1</div>
                      <div className="field-row"><label>Runs<input type="number" value={fx.t1Runs} onChange={e=>setFx({...fx,t1Runs:Number(e.target.value)})}/></label><label>Overs<input type="number" step={0.1} value={fx.t1Overs} onChange={e=>setFx({...fx,t1Overs:Number(e.target.value)})}/></label><label className="checkbox-inline"><input type="checkbox" checked={fx.t1AllOut} onChange={e=>setFx({...fx,t1AllOut:e.target.checked})}/> All out</label></div>
                      <div className="standings-subhead">Team 2</div>
                      <div className="field-row"><label>Runs<input type="number" value={fx.t2Runs} onChange={e=>setFx({...fx,t2Runs:Number(e.target.value)})}/></label><label>Overs<input type="number" step={0.1} value={fx.t2Overs} onChange={e=>setFx({...fx,t2Overs:Number(e.target.value)})}/></label><label className="checkbox-inline"><input type="checkbox" checked={fx.t2AllOut} onChange={e=>setFx({...fx,t2AllOut:e.target.checked})}/> All out</label></div>
                    </>)}
                    <button className="btn accent" type="button" onClick={()=>void addFixtureResult()} disabled={saving}>Save result</button>
                  </>
                )}
                <h3 style={{marginTop:16}}>Fixtures ({fixtures.length})</h3>
                <ul className="standings-results">{fixtures.map(f => <li key={f.id} className="standings-result-row"><span>{f.team1_name ?? f.team1_id} vs {f.team2_name ?? f.team2_id} — {f.status}</span></li>)}</ul>
              </section>
            )}

            {tab==='standings' && (
              <section className="standings-section">
                <h3>Points Table</h3>
                <div className="points-table-wrap">
                  <table className="points-table">
                    <thead><tr><th>Team</th><th>M</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>Pts</th><th>NRR</th></tr></thead>
                    <tbody>
                      {standings.rows.map(r => (<tr key={r.teamId}><td className="pt-team">{r.teamName}</td><td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td><td>{r.noResult}</td><td className="pt-pts">{r.points}</td><td className={r.nrr>=0?'pt-nrr pos':'pt-nrr neg'}>{formatNRR(r.nrr)}</td></tr>))}
                      {standings.rows.length===0 && <tr><td colSpan={8} className="muted">Add teams and completed results.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <SmartNRRCalculator rows={standings.rows} quotaOvers={tournament?.overs_per_innings ?? 20} />
              </section>
            )}

            {tab==='leaderboard' && (
              <section className="standings-section">
                <h3>Leaderboard (MVP, manual entry)</h3>
                <p className="muted">Best-effort: enter player performance aggregates to compute batting/bowling leaders. Full auto-aggregation from ball-by-ball events can be wired next.</p>
                <div className="field-row"><label>Player<input value={boardForm.playerName} onChange={e=>setBoardForm({...boardForm,playerName:e.target.value})}/></label><label>Team<input value={boardForm.teamName} onChange={e=>setBoardForm({...boardForm,teamName:e.target.value})}/></label></div>
                <div className="field-row"><label>Runs<input type="number" value={boardForm.runs} onChange={e=>setBoardForm({...boardForm,runs:Number(e.target.value)})}/></label><label>Wickets<input type="number" value={boardForm.wickets} onChange={e=>setBoardForm({...boardForm,wickets:Number(e.target.value)})}/></label><label>Overs<input type="number" step={0.1} value={boardForm.overs} onChange={e=>setBoardForm({...boardForm,overs:Number(e.target.value)})}/></label></div>
                <button className="btn" type="button" onClick={addBoardEntry}>Add entry</button>
                <div className="field-row" style={{alignItems:'start'}}>
                  <div style={{flex:1}}><h4>Most Runs</h4>{leaderboard.batting.slice(0,10).map((p,i)=><div key={p.playerId} className="standings-result-row"><span>{i+1}. {p.playerName} ({p.teamName})</span><strong>{p.runs}</strong></div>)}</div>
                  <div style={{flex:1}}><h4>Most Wickets</h4>{leaderboard.bowling.slice(0,10).map((p,i)=><div key={p.playerId} className="standings-result-row"><span>{i+1}. {p.playerName} ({p.teamName})</span><strong>{p.wickets}</strong></div>)}</div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
