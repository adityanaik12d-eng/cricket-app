import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { ScoringScreen } from './ScoringScreen'
import type { CreateMatchBody } from './api'

type Route = { name: 'setup' } | { name: 'match'; matchId: string }

function parseHash(): Route {
  const hash = window.location.hash
  const match = /^#\/match\/(.+)$/.exec(hash)
  if (match && match[1]) return { name: 'match', matchId: match[1] }
  return { name: 'setup' }
}

function slug(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'team'
  )
}

function makeLineup(teamId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${teamId}-${i + 1}`)
}

interface TossDraft {
  matchId: string
  teamAId: string
  teamBId: string
  oversPerInnings: number
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHash = (): void => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.name === 'match') {
    return <ScoringScreen matchId={route.matchId} onLeave={() => { window.location.hash = '' }} />
  }
  return <SetupFlow />
}

function SetupFlow() {
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [overs, setOvers] = useState(20)
  const [players, setPlayers] = useState(11)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toss, setToss] = useState<TossDraft | null>(null)

  async function createMatch(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const teamAId = slug(teamA) || 'team-a'
      const teamBId = slug(teamB) || 'team-b'
      const body: CreateMatchBody = {
        teamAId,
        teamBId,
        lineups: { A: makeLineup(teamAId, players), B: makeLineup(teamBId, players) },
        oversPerInnings: overs,
        powerplayOvers: Math.min(6, overs),
      }
      const created = await api.createMatch(body)
      setToss({ matchId: created.matchId, teamAId, teamBId, oversPerInnings: overs })
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create match')
    } finally {
      setBusy(false)
    }
  }

  async function recordToss(winnerTeamId: string, winnerDecision: 'BAT' | 'BOWL'): Promise<void> {
    if (!toss) return
    setError(null)
    setBusy(true)
    try {
      await api.postEvent(toss.matchId, { type: 'TOSS', winnerTeamId, winnerDecision })
      window.location.hash = `#/match/${toss.matchId}`
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not record toss')
    } finally {
      setBusy(false)
    }
  }

  if (toss) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
        </header>
        <main className="card setup-card">
          <h2>Toss</h2>
          <p className="muted">
            {toss.teamAId} vs {toss.teamBId} · {toss.oversPerInnings} overs
          </p>
          <div className="toss-grid">
            {[toss.teamAId, toss.teamBId].map((team) => (
              <div key={team} className="toss-team">
                <h3>{team}</h3>
                <div className="btn-row">
                  <button className="btn accent" disabled={busy} onClick={() => void recordToss(team, 'BAT')}>
                    Bat
                  </button>
                  <button className="btn" disabled={busy} onClick={() => void recordToss(team, 'BOWL')}>
                    Bowl
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn ghost" onClick={() => setToss(null)}>
            Back
          </button>
          {error && <p className="error">{error}</p>}
        </main>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Cricket Scorer</h1>
      </header>
      <main className="card setup-card">
        <h2>New match</h2>
        <form onSubmit={(e) => void createMatch(e)}>
          <label>
            Team A
            <input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="India" required />
          </label>
          <label>
            Team B
            <input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Australia" required />
          </label>
          <div className="field-row">
            <label>
              Overs
              <input
                type="number"
                min={1}
                max={90}
                value={overs}
                onChange={(e) => setOvers(Number(e.target.value) || 20)}
              />
            </label>
            <label>
              Players
              <input
                type="number"
                min={2}
                max={15}
                value={players}
                onChange={(e) => setPlayers(Number(e.target.value) || 11)}
              />
            </label>
          </div>
          <button className="btn accent wide" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create match'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </main>
    </div>
  )
}
