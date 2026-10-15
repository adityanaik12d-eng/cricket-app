import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { ScoringScreen } from './ScoringScreen'
import { SigninScreen } from './SigninScreen'
import { ProfileScreen } from './ProfileScreen'
import type { CreateMatchBody, Player } from './api'
import { type LineupEntry, buildLineupRefs, directoryEntry, newLocalEntry, resetLocalIds } from './lineup'

type Route =
  | { name: 'setup' }
  | { name: 'match'; matchId: string }
  | { name: 'signin' }
  | { name: 'profile' }

function parseHash(): Route {
  const hash = window.location.hash
  const match = /^#\/match\/(.+)$/.exec(hash)
  if (match && match[1]) return { name: 'match', matchId: match[1] }
  if (hash === '#/signin') return { name: 'signin' }
  if (hash === '#/profile') return { name: 'profile' }
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
  if (route.name === 'signin') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
        </header>
        <SigninScreen onDone={() => { window.location.hash = '#/profile' }} />
      </div>
    )
  }
  if (route.name === 'profile') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
        </header>
        <ProfileScreen onSignedOut={() => { window.location.hash = '#/' }} />
      </div>
    )
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

  const [lineupA, setLineupA] = useState<LineupEntry[]>([])
  const [lineupB, setLineupB] = useState<LineupEntry[]>([])

  const [modeA, setModeA] = useState<'name' | 'number'>('name')
  const [modeB, setModeB] = useState<'name' | 'number'>('name')
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [numA, setNumA] = useState('')
  const [numB, setNumB] = useState('')
  const [resultsA, setResultsA] = useState<Player[]>([])
  const [resultsB, setResultsB] = useState<Player[]>([])
  const [searchingA, setSearchingA] = useState(false)
  const [searchingB, setSearchingB] = useState(false)
  const [showCreateA, setShowCreateA] = useState(false)
  const [showCreateB, setShowCreateB] = useState(false)
  const [newNameA, setNewNameA] = useState('')
  const [newNameB, setNewNameB] = useState('')
  const [creatingA, setCreatingA] = useState(false)
  const [creatingB, setCreatingB] = useState(false)

  function takenIdsA(): string[] {
    return lineupA.map((e) => e.id)
  }
  function takenIdsB(): string[] {
    return lineupB.map((e) => e.id)
  }

  function quickFillA(): void {
    const taken = takenIdsA()
    const next: LineupEntry[] = []
    for (let i = 0; i < players; i++) {
      next.push(newLocalEntry('Player ' + (i + 1), taken.concat(next.map((e) => e.id))))
    }
    setLineupA(next)
    setResultsA([])
    setShowCreateA(false)
  }

  function quickFillB(): void {
    const taken = takenIdsB()
    const next: LineupEntry[] = []
    for (let i = 0; i < players; i++) {
      next.push(newLocalEntry('Player ' + (i + 1), taken.concat(next.map((e) => e.id))))
    }
    setLineupB(next)
    setResultsB([])
    setShowCreateB(false)
  }

  useEffect(() => {
    resetLocalIds()
  }, [])

  useEffect(() => {
    if (numA.length >= 4) {
      const v = numA
      setSearchingA(true)
      const t = setTimeout(() => {
        api.searchPlayers(v)
          .then((r) => {
            if (v === numA) {
              setResultsA(r.players)
            }
          })
          .catch(() => {
            if (v === numA) {
              setResultsA([])
            }
          })
          .finally(() => {
            if (v === numA) {
              setSearchingA(false)
            }
          })
      }, 200)
      return () => clearTimeout(t)
    } else {
      setResultsA([])
      setShowCreateA(false)
      setNewNameA('')
      setSearchingA(false)
    }
    return undefined
  }, [numA])

  useEffect(() => {
    if (numB.length >= 4) {
      const v = numB
      setSearchingB(true)
      const t = setTimeout(() => {
        api.searchPlayers(v)
          .then((r) => {
            if (v === numB) {
              setResultsB(r.players)
            }
          })
          .catch(() => {
            if (v === numB) {
              setResultsB([])
            }
          })
          .finally(() => {
            if (v === numB) {
              setSearchingB(false)
            }
          })
      }, 200)
      return () => clearTimeout(t)
    } else {
      setResultsB([])
      setShowCreateB(false)
      setNewNameB('')
      setSearchingB(false)
    }
    return undefined
  }, [numB])

  function addByNameA(): void {
    if (!nameA.trim()) return
    const e = newLocalEntry(nameA, takenIdsA())
    setLineupA((prev) => [...prev, e])
    setNameA('')
  }

  function addByNameB(): void {
    if (!nameB.trim()) return
    const e = newLocalEntry(nameB, takenIdsB())
    setLineupB((prev) => [...prev, e])
    setNameB('')
  }

  function addDirectoryA(p: Player): void {
    const e = directoryEntry(p)
    setLineupA((prev) => [...prev, e])
    setNumA('')
    setResultsA([])
    setShowCreateA(false)
  }

  function addDirectoryB(p: Player): void {
    const e = directoryEntry(p)
    setLineupB((prev) => [...prev, e])
    setNumB('')
    setResultsB([])
    setShowCreateB(false)
  }

  function removeA(id: string): void {
    setLineupA((prev) => prev.filter((x) => x.id !== id))
  }

  function removeB(id: string): void {
    setLineupB((prev) => prev.filter((x) => x.id !== id))
  }

  async function createNewA(): Promise<void> {
    if (!numA || !newNameA.trim()) return
    setCreatingA(true)
    try {
      const res = await api.createPlayer(numA, newNameA)
      addDirectoryA(res.player)
      setShowCreateA(false)
      setNewNameA('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create player')
    } finally {
      setCreatingA(false)
    }
  }

  async function createNewB(): Promise<void> {
    if (!numB || !newNameB.trim()) return
    setCreatingB(true)
    try {
      const res = await api.createPlayer(numB, newNameB)
      addDirectoryB(res.player)
      setShowCreateB(false)
      setNewNameB('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create player')
    } finally {
      setCreatingB(false)
    }
  }

  async function createMatch(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (lineupA.length < 11 || lineupB.length < 11) {
      setError('Each side must have at least 11 players')
      return
    }
    setBusy(true)
    try {
      const teamAId = slug(teamA) || 'team-a'
      const teamBId = slug(teamB) || 'team-b'
      const a = buildLineupRefs(lineupA)
      const b = buildLineupRefs(lineupB)
      const body: CreateMatchBody = {
        teamAId,
        teamBId,
        lineups: { A: a.ids, B: b.ids },
        playerRefs: { ...a.refs, ...b.refs },
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

          <div className="lineup-section">
            <div className="lineup-head">
              <h3>Team A Lineup ({lineupA.length})</h3>
              <button className="btn ghost" type="button" onClick={quickFillA}>
                Quick fill
              </button>
            </div>
            <div className="chip-row">
              {lineupA.map((e) => (
                <span key={e.id} className="chip">
                  {e.name}
                  <button className="chip-x" type="button" onClick={() => removeA(e.id)} aria-label="remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mode-toggle">
              <button
                className={modeA === 'name' ? 'tab active' : 'tab'}
                type="button"
                onClick={() => setModeA('name')}
              >
                By name
              </button>
              <button
                className={modeA === 'number' ? 'tab active' : 'tab'}
                type="button"
                onClick={() => setModeA('number')}
              >
                By number
              </button>
            </div>
            {modeA === 'name' ? (
              <div className="add-row">
                <input value={nameA} onChange={(e) => setNameA(e.target.value)} placeholder="Player name" />
                <button className="btn" type="button" onClick={addByNameA} disabled={!nameA.trim()}>
                  Add
                </button>
              </div>
            ) : (
              <div className="add-col">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={numA}
                  onChange={(e) => setNumA(e.target.value.replace(/\D/g, ''))}
                  placeholder="Mobile number (min 4 digits)"
                />
                {searchingA && <p className="muted">Searching...</p>}
                {resultsA.length > 0 && (
                  <div className="suggestions">
                    {resultsA.map((p) => (
                      <button key={p.id} className="suggestion" type="button" onClick={() => addDirectoryA(p)}>
                        {p.name} · {p.role} · {p.mobile}
                      </button>
                    ))}
                  </div>
                )}
                {numA.length >= 4 && !searchingA && resultsA.length === 0 && (
                  <div className="create-new">
                    <p className="muted">No results for '{numA}'</p>
                    <button className="btn ghost" type="button" onClick={() => setShowCreateA((v) => !v)}>
                      Add '{numA}' as new player
                    </button>
                    {showCreateA && (
                      <div className="add-row">
                        <input
                          value={newNameA}
                          onChange={(e) => setNewNameA(e.target.value)}
                          placeholder="Player name"
                        />
                        <button
                          className="btn"
                          type="button"
                          onClick={() => void createNewA()}
                          disabled={creatingA || !newNameA.trim()}
                        >
                          {creatingA ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lineup-section">
            <div className="lineup-head">
              <h3>Team B Lineup ({lineupB.length})</h3>
              <button className="btn ghost" type="button" onClick={quickFillB}>
                Quick fill
              </button>
            </div>
            <div className="chip-row">
              {lineupB.map((e) => (
                <span key={e.id} className="chip">
                  {e.name}
                  <button className="chip-x" type="button" onClick={() => removeB(e.id)} aria-label="remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mode-toggle">
              <button
                className={modeB === 'name' ? 'tab active' : 'tab'}
                type="button"
                onClick={() => setModeB('name')}
              >
                By name
              </button>
              <button
                className={modeB === 'number' ? 'tab active' : 'tab'}
                type="button"
                onClick={() => setModeB('number')}
              >
                By number
              </button>
            </div>
            {modeB === 'name' ? (
              <div className="add-row">
                <input value={nameB} onChange={(e) => setNameB(e.target.value)} placeholder="Player name" />
                <button className="btn" type="button" onClick={addByNameB} disabled={!nameB.trim()}>
                  Add
                </button>
              </div>
            ) : (
              <div className="add-col">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={numB}
                  onChange={(e) => setNumB(e.target.value.replace(/\D/g, ''))}
                  placeholder="Mobile number (min 4 digits)"
                />
                {searchingB && <p className="muted">Searching...</p>}
                {resultsB.length > 0 && (
                  <div className="suggestions">
                    {resultsB.map((p) => (
                      <button key={p.id} className="suggestion" type="button" onClick={() => addDirectoryB(p)}>
                        {p.name} · {p.role} · {p.mobile}
                      </button>
                    ))}
                  </div>
                )}
                {numB.length >= 4 && !searchingB && resultsB.length === 0 && (
                  <div className="create-new">
                    <p className="muted">No results for '{numB}'</p>
                    <button className="btn ghost" type="button" onClick={() => setShowCreateB((v) => !v)}>
                      Add '{numB}' as new player
                    </button>
                    {showCreateB && (
                      <div className="add-row">
                        <input
                          value={newNameB}
                          onChange={(e) => setNewNameB(e.target.value)}
                          placeholder="Player name"
                        />
                        <button
                          className="btn"
                          type="button"
                          onClick={() => void createNewB()}
                          disabled={creatingB || !newNameB.trim()}
                        >
                          {creatingB ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn accent wide" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create match'}
          </button>
        </form>
      </main>
    </div>
  )
}
