import { useEffect, useState } from 'react'
import { api, ApiRequestError } from './api'
import { ScoringScreen } from './ScoringScreen'
import { SigninScreen } from './SigninScreen'
import { SignupScreen } from './SignupScreen'
import { ProfileScreen } from './ProfileScreen'
import { HomeScreen } from './HomeScreen'
import { SettingsScreen } from './SettingsScreen'
import { StandingsScreen } from './StandingsScreen'
import { TournamentsScreen } from './TournamentsScreen'
import { TournamentDetailScreen } from './TournamentDetailScreen'
import { DLSScreen } from './DLSScreen'
import { TeamsScreen } from './TeamsScreen'
import { EditMatchScreen } from './EditMatchScreen'
import { parseHash } from './routes'
import type { Route } from './routes'
import { getSupabase } from './supabase'
import { rememberMatch } from './myMatches'
import { createScorerToken, storeScorerToken } from './ownership'
import type { CreateMatchBody, Player, SearchPlayer } from './api'
import { type LineupEntry, buildLineupRefs, directoryEntry, directoryEntryFromSearch, newLocalEntry, resetLocalIds } from './lineup'
import { ThemeToggle } from './ui/ThemeToggle'
import { initTheme } from './ui/theme'
import { isCreatorAdminEmail } from './admin'
import { AdminPortalScreen } from './AdminPortalScreen'

// Reflect the stored theme before first paint (no-op outside the browser).
initTheme()

function AdminGate() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabase()
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null)
      setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
      setUser(s?.user ? { id: s.user.id, email: s.user.email ?? null } : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <main className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
        <p className="muted" style={{ textAlign: 'center' }}>Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Admin Portal</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>Sign in as the creator admin to access this page.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn accent" onClick={() => window.location.hash = '#/signin'}>Sign In</button>
          <button className="btn ghost" onClick={() => window.location.hash = '#/'}>Home</button>
        </div>
      </main>
    )
  }

  if (!isCreatorAdminEmail(user.email)) {
    return (
      <main className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Access Denied</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>This area is restricted to the creator admin only.</p>
        <button className="btn ghost wide" onClick={() => window.location.hash = '#/'}>Back to Home</button>
      </main>
    )
  }

  return <AdminPortalScreen />
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
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHash = (): void => {
      const next = parseHash(window.location.hash)
      setRoute(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.name === 'home') {
    return (
      <HomeScreen
        onNewMatch={() => { window.location.hash = '#/new' }}
        onOpenMatch={(matchId) => { window.location.hash = `#/match/${matchId}/report` }}
      />
    )
  }
  if (route.name === 'match') {
    return (
      <ScoringScreen
        matchId={route.matchId}
        initialTab={route.tab}
        onLeave={() => { window.location.hash = '#/' }}
      />
    )
  }
  if (route.name === 'signin') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <SigninScreen onDone={() => { window.location.hash = '#/'; }} />
      </div>
    )
  }
  if (route.name === 'signup') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <SignupScreen onDone={() => { window.location.hash = '#/'; }} />
      </div>
    )
  }
  if (route.name === 'profile') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <ProfileScreen onSignedOut={() => { window.location.hash = '#/' }} />
      </div>
    )
  }
  if (route.name === 'settings') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <SettingsScreen onBack={() => { window.location.hash = '#/' }} />
      </div>
    )
  }
  if (route.name === 'standings') {
    return <StandingsScreen onBack={() => { window.location.hash = '#/' }} />
  }
  if (route.name === 'tournaments') {
    return <TournamentsScreen onBack={() => { window.location.hash = '#/' }} onOpen={(id) => { window.location.hash = `#/tournament/${id}` }} />
  }
  if (route.name === 'tournament') {
    return <TournamentDetailScreen tournamentId={route.tournamentId} onBack={() => { window.location.hash = '#/tournaments' }} />
  }
  if (route.name === 'dls') {
    return <DLSScreen onBack={() => { window.location.hash = '#/' }} />
  }
  if (route.name === 'teams') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <TeamsScreen onBack={() => { window.location.hash = '#/' }} />
      </div>
    )
  }
  if (route.name === 'edit-match') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <EditMatchScreen matchId={route.matchId} onBack={() => { window.location.hash = `#/match/${route.matchId}/report` }} />
      </div>
    )
  }
  if (route.name === 'admin') {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <AdminGate />
      </div>
    )
  }
  if (route.name === 'setup') {
    return <SetupFlow />
  }
  return <SetupFlow />
}

function SetupFlow() {
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [overs, setOvers] = useState(20)
  const [players, setPlayers] = useState(11)
  const [superOverEnabled, setSuperOverEnabled] = useState(false)
  const [superOverOvers, setSuperOverOvers] = useState(1)
  const [superOverMaxWickets, setSuperOverMaxWickets] = useState(2)
  const [singleBatter, setSingleBatter] = useState(false)
  const [maxWickets, setMaxWickets] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toss, setToss] = useState<TossDraft | null>(null)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [coinFlipping, setCoinFlipping] = useState(false)
  const [coinSide, setCoinSide] = useState<'heads' | 'tails'>('heads')
  const [tossWinner, setTossWinner] = useState<string | null>(null)

  const [lineupA, setLineupA] = useState<LineupEntry[]>([])
  const [lineupB, setLineupB] = useState<LineupEntry[]>([])

  const [modeA, setModeA] = useState<'name' | 'number' | 'team'>('name')
  const [modeB, setModeB] = useState<'name' | 'number' | 'team'>('name')
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [numA, setNumA] = useState('')
  const [numB, setNumB] = useState('')
  const [resultsA, setResultsA] = useState<SearchPlayer[]>([])
  const [resultsB, setResultsB] = useState<SearchPlayer[]>([])
  const [searchingA, setSearchingA] = useState(false)
  const [searchingB, setSearchingB] = useState(false)
  const [showCreateA, setShowCreateA] = useState(false)
  const [showCreateB, setShowCreateB] = useState(false)
  const [newNameA, setNewNameA] = useState('')
  const [newNameB, setNewNameB] = useState('')
  const [creatingA, setCreatingA] = useState(false)
  const [creatingB, setCreatingB] = useState(false)

  // Team picker state
  const [teams, setTeams] = useState<Array<{id: string; name: string; short_name: string; colour: string}>>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTeamA, setSelectedTeamA] = useState<string | null>(null)
  const [selectedTeamB, setSelectedTeamB] = useState<string | null>(null)
  const [importingTeamA, setImportingTeamA] = useState(false)
  const [importingTeamB, setImportingTeamB] = useState(false)

  // Load teams on mount
  useEffect(() => {
    async function load() {
      setTeamsLoading(true)
      try {
        const data = await api.listMyTeams()
        setTeams(data)
      } catch {
        setTeams([])
      } finally {
        setTeamsLoading(false)
      }
    }
    load()
  }, [])

  // Coin flip effect
  useEffect(() => {
    if (!coinFlipping) return
    // Randomly pick winner after animation
    const timeout = setTimeout(() => {
      const winner = Math.random() > 0.5 ? toss?.teamAId : toss?.teamBId
      setTossWinner(winner ?? '')
      setCoinSide(Math.random() > 0.5 ? 'heads' : 'tails')
      setCoinFlipping(false)
    }, 1500)
    return () => clearTimeout(timeout)
  }, [coinFlipping, toss])

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

  async function importTeamRoster(teamId: string, isTeamA: boolean): Promise<void> {
    if (isTeamA) setImportingTeamA(true)
    else setImportingTeamB(true)
    setError(null)
    try {
      const { data, error } = await getSupabase()
        .from('team_members')
        .select(`
          player_id,
          players!inner (
            id,
            name,
            is_guest
          )
        `)
        .eq('team_id', teamId)
      if (error) throw error
      const taken = isTeamA ? takenIdsA() : takenIdsB()
      const next: LineupEntry[] = []
      for (const row of data ?? []) {
        const p = row.players as unknown as SearchPlayer
        if (!p) continue
        next.push({ id: p.id, name: p.name, mobile: undefined, verified: !p.is_guest, playerId: p.id })
      }
      if (isTeamA) setLineupA(next)
      else setLineupB(next)
      if (isTeamA) setSelectedTeamA(teamId)
      else setSelectedTeamB(teamId)
      if (isTeamA) { setResultsA([]); setShowCreateA(false); setNumA('') }
      else { setResultsB([]); setShowCreateB(false); setNumB('') }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not import team roster')
    } finally {
      if (isTeamA) setImportingTeamA(false)
      else setImportingTeamB(false)
    }
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

  function addDirectoryA(p: SearchPlayer | Player): void {
    const e = 'is_guest' in p ? directoryEntryFromSearch(p) : directoryEntry(p)
    setLineupA((prev) => [...prev, e])
    setNumA('')
    setResultsA([])
    setShowCreateA(false)
  }

  function addDirectoryB(p: SearchPlayer | Player): void {
    const e = 'is_guest' in p ? directoryEntryFromSearch(p) : directoryEntry(p)
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
    // Minimum players per side
    // Normal mode: maxWickets + 1 (all out + 1 not out)
    // Single batter mode: maxWickets (one batter only, no non-striker)
    const minPlayers = singleBatter ? maxWickets : Math.max(2, Math.min(11, overs + 1))
    if (lineupA.length < minPlayers || lineupB.length < minPlayers) {
      setError(`Each side must have at least ${minPlayers} players for a ${overs}-over match`)
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
        superOverEnabled,
        ...(superOverEnabled ? { superOverOvers, superOverMaxWickets } : {}),
        singleBatter,
        maxWickets,
      }
      const token = createScorerToken()
      const created = await api.createMatch(body, token)
      rememberMatch(created.matchId)
      // This browser owns the match from now on: it keeps the scorer token,
      // and the database only accepts writes that carry it.
      storeScorerToken(created.matchId, token)
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
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <main className="card setup-card toss-screen">
          <div className="toss-header">
            <div className="toss-ribbon">TOSS</div>
            <h2>Coin Toss</h2>
            <p className="muted">{toss.teamAId} vs {toss.teamBId} · {toss.oversPerInnings} overs</p>
          </div>
          
          <div className="coin-flip" onClick={() => !busy && setCoinFlipping(true)}>
            <div className={`coin ${coinSide} ${coinFlipping ? 'flipping' : ''}`}>
              <div className="coin-face heads">
                <span className="coin-icon">🏏</span>
                <span className="coin-label">HEADS</span>
              </div>
              <div className="coin-face tails">
                <span className="coin-icon">🏏</span>
                <span className="coin-label">TAILS</span>
              </div>
            </div>
            <p className="coin-prompt">{coinFlipping ? 'Flipping...' : 'Tap coin to flip'}</p>
          </div>

          {!coinFlipping && tossWinner && (
            <div className="toss-result">
              <p className="muted">Winner: <strong>{tossWinner}</strong></p>
              <div className="btn-row">
                <button className="btn accent" disabled={busy} onClick={() => void recordToss(tossWinner, 'BAT')}>
                  Bat
                </button>
                <button className="btn secondary" disabled={busy} onClick={() => void recordToss(tossWinner, 'BOWL')}>
                  Bowl
                </button>
              </div>
            </div>
          )}

          <button className="btn ghost" onClick={() => { setToss(null); setCoinFlipping(false); setTossWinner(null); setCoinSide('heads'); }}>
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
        <div className="topbar-actions">
          <ThemeToggle />
          <button className="btn ghost" onClick={() => (window.location.hash = '#/')}>Back</button>
        </div>
      </header>
      <main className="card setup-card ms-wizard scorebook-cover">
        <div className="ms-wizard-head cover-header">
          <div className="cover-ribbon">NEW MATCH</div>
          <div>
            <h2 style={{ margin: 0 }}>Scorebook Cover</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Fill in the match details</p>
          </div>
        </div>
        <div className="ms-stepper cover-stepper" aria-label="Setup steps">
          <button type="button" className={`ms-step ${wizardStep === 1 ? 'active' : wizardStep > 1 ? 'done' : ''}`} onClick={() => setWizardStep(1)}>
            <span className="ms-step-num">1</span><span>Match Details</span>
          </button>
          <button type="button" className={`ms-step ${wizardStep === 2 ? 'active' : ''}`} onClick={() => { if (teamA.trim() && teamB.trim()) setWizardStep(2); }}>
            <span className="ms-step-num">2</span><span>Lineups</span>
          </button>
        </div>
        <form onSubmit={(e) => void createMatch(e)}>
          {wizardStep === 1 && (
            <div className="ms-reveal cover-page">
              <div className="cover-fields">
                {/* Team Picker - Primary mode when teams exist */}
                {teams.length > 0 && !teamsLoading && (
                  <div className="team-picker-section">
                    <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
                      {teamA || teamB ? 'Or enter team names manually:' : 'Select your created teams:'}
                    </p>
                    <div className="team-picker-row">
                      <div className="team-picker-col">
                        <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--fg-muted)' }}>Team A</h4>
                        <div className="team-picker">
                          {teams.map(t => (
                            <button
                              key={t.id}
                              className={`team-option ${selectedTeamA === t.id ? 'selected' : ''}`}
                              type="button"
                              onClick={() => {
                                setSelectedTeamA(t.id)
                                setTeamA(t.name)
                              }}
                              disabled={importingTeamA}
                              style={{ borderColor: t.colour }}
                            >
                              <span className="team-option-colour" style={{ background: t.colour }} />
                              <span className="team-option-name">{t.name}</span>
                              <span className="team-option-short">({t.short_name})</span>
                            </button>
                          ))}
                        </div>
                        {selectedTeamA && (
                          <div className="team-selected-actions">
                            <label className="form-field" style={{ marginTop: 8 }}>
                              <span className="form-label">Team A name</span>
                              <input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="India" required />
                            </label>
                            <button className="btn accent" type="button" onClick={() => void importTeamRoster(selectedTeamA, true)} disabled={importingTeamA}>
                              {importingTeamA ? 'Importing…' : 'Import roster'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="team-picker-col">
                        <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--fg-muted)' }}>Team B</h4>
                        <div className="team-picker">
                          {teams.map(t => (
                            <button
                              key={t.id}
                              className={`team-option ${selectedTeamB === t.id ? 'selected' : ''}`}
                              type="button"
                              onClick={() => {
                                setSelectedTeamB(t.id)
                                setTeamB(t.name)
                              }}
                              disabled={importingTeamB}
                              style={{ borderColor: t.colour }}
                            >
                              <span className="team-option-colour" style={{ background: t.colour }} />
                              <span className="team-option-name">{t.name}</span>
                              <span className="team-option-short">({t.short_name})</span>
                            </button>
                          ))}
                        </div>
                        {selectedTeamB && (
                          <div className="team-selected-actions">
                            <label className="form-field" style={{ marginTop: 8 }}>
                              <span className="form-label">Team B name</span>
                              <input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Australia" required />
                            </label>
                            <button className="btn accent" type="button" onClick={() => void importTeamRoster(selectedTeamB, false)} disabled={importingTeamB}>
                              {importingTeamB ? 'Importing…' : 'Import roster'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual entry fallback / when no teams */}
                {(teams.length === 0 || teamsLoading) && (
                  <>
                    <label className="form-field">
                      <span className="form-label">Team A</span>
                      <input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="India" required />
                    </label>
                    <label className="form-field">
                      <span className="form-label">Team B</span>
                      <input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Australia" required />
                    </label>
                  </>
                )}

                {/* Also show manual inputs when teams exist but user wants to override */}
                {teams.length > 0 && !teamsLoading && (
                  <details className="manual-entry-toggle">
                    <summary className="muted" style={{ cursor: 'pointer', marginTop: 12, fontSize: 14 }}>
                      Enter team names manually
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      <label className="form-field">
                        <span className="form-label">Team A</span>
                        <input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="India" required />
                      </label>
                      <label className="form-field">
                        <span className="form-label">Team B</span>
                        <input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Australia" required />
                      </label>
                    </div>
                  </details>
                )}
                <div className="field-row">
                  <label className="form-field">
                    <span className="form-label">Overs</span>
                    <input type="number" min={1} max={90} value={overs} onChange={(e) => setOvers(Number(e.target.value) || 20)} />
                  </label>
                  <label className="form-field">
                    <span className="form-label">Players</span>
                    <input type="number" min={2} max={15} value={players} onChange={(e) => setPlayers(Number(e.target.value) || 11)} />
                  </label>
                </div>
                <div className="field-row">
                  <label className="checkbox-inline">
                    <input type="checkbox" checked={superOverEnabled} onChange={(e) => setSuperOverEnabled(e.target.checked)} />
                    Enable Superover (for tied matches)
                  </label>
                </div>
                {superOverEnabled && (
                  <div className="field-row">
                    <label className="form-field">
                      <span className="form-label">Superover Overs</span>
                      <input type="number" min={1} max={3} value={superOverOvers} onChange={(e) => setSuperOverOvers(Number(e.target.value) || 1)} />
                    </label>
                    <label className="form-field">
                      <span className="form-label">Superover Max Wickets</span>
                      <input type="number" min={1} max={10} value={superOverMaxWickets} onChange={(e) => setSuperOverMaxWickets(Number(e.target.value) || 2)} />
                    </label>
                  </div>
                )}
                <div className="field-row">
                  <label className="form-field">
                    <span className="form-label">Max Wickets</span>
                    <input type="number" min={1} max={10} value={maxWickets} onChange={(e) => setMaxWickets(Number(e.target.value) || 10)} />
                  </label>
                </div>
                <div className="field-row">
                  <label className="checkbox-inline">
                    <input type="checkbox" checked={singleBatter} onChange={(e) => setSingleBatter(e.target.checked)} />
                    Single batter mode (one batter faces all balls)
                  </label>
                </div>
              </div>
              <button className="btn accent wide" type="button" onClick={() => { if (!teamA.trim() || !teamB.trim()) { setError('Enter both team names.'); return; } setError(null); setWizardStep(2); }}>
                Next: Lineups
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="ms-reveal cover-page">
              <div className="lineup-section">
                <div className="lineup-head">
                  <h3>Team A Lineup ({lineupA.length})</h3>
                  <button className="btn ghost" type="button" onClick={quickFillA}>
                    Quick fill
                  </button>
                </div>
                <div className="chip-row">
                  {lineupA.map((e) => (
                    <span key={e.id} className="chip removable">
                      {e.name}
                      <button className="chip-remove" type="button" onClick={() => removeA(e.id)} aria-label="remove">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="paper-tabs" role="tablist">
                  <button role="tab" className={modeA === 'name' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeA('name')}>By name</button>
                  <button role="tab" className={modeA === 'number' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeA('number')}>Search by mobile</button>
                  {teams.length > 0 && (
                    <button role="tab" className={modeA === 'team' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeA('team')}>By team</button>
                  )}
                </div>
                {modeA === 'name' ? (
                  <div className="add-row">
                    <input value={nameA} onChange={(e) => setNameA(e.target.value)} placeholder="Player name" />
                    <button className="btn" type="button" onClick={addByNameA} disabled={!nameA.trim()}>Add</button>
                  </div>
                ) : modeA === 'number' ? (
                  <div className="add-col">
                    <input type="tel" inputMode="numeric" pattern="[0-9]*" value={numA} onChange={(e) => setNumA(e.target.value.replace(/\D/g, ''))} placeholder="Mobile number (last 10 digits, min 8)" />
                    <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Searches your directory by mobile number</p>
                    {searchingA && <p className="muted">Searching...</p>}
                    {resultsA.length > 0 && (
                      <div className="suggestions">
                        {resultsA.map((p) => (
                          <button key={p.id} className="suggestion" type="button" onClick={() => addDirectoryA(p)}>
                            {p.name} {p.is_guest ? '· Guest' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    {numA.length >= 4 && !searchingA && resultsA.length === 0 && (
                      <div className="create-new">
                        <p className="muted">No results for '{numA}'</p>
                        <button className="btn ghost" type="button" onClick={() => setShowCreateA((v) => !v)}>Add '{numA}' as new player</button>
                        {showCreateA && (
                          <div className="add-row">
                            <input value={newNameA} onChange={(e) => setNewNameA(e.target.value)} placeholder="Player name" />
                            <button className="btn" type="button" onClick={() => void createNewA()} disabled={creatingA || !newNameA.trim()}>
                              {creatingA ? 'Creating...' : 'Create'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="add-col">
                    {teamsLoading ? (
                      <p className="muted" style={{ textAlign: 'center', padding: 16 }}>Loading teams…</p>
                    ) : teams.length === 0 ? (
                      <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No teams yet. <a href="#/teams" onClick={(e) => { e.preventDefault(); window.location.hash = '#/teams'; }}>Create a team first</a>.</p>
                    ) : (
                      <div className="team-picker">
                        {teams.map(t => (
                          <button
                            key={t.id}
                            className={`team-option ${selectedTeamA === t.id ? 'selected' : ''}`}
                            type="button"
                            onClick={() => void importTeamRoster(t.id, true)}
                            disabled={importingTeamA}
                            style={{ borderColor: t.colour }}
                          >
                            <span className="team-option-colour" style={{ background: t.colour }} />
                            <span className="team-option-name">{t.name}</span>
                            <span className="team-option-short">({t.short_name})</span>
                            {importingTeamA && selectedTeamA === t.id && <span className="muted">Importing…</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="lineup-section">
                <div className="lineup-head">
                  <h3>Team B Lineup ({lineupB.length})</h3>
                  <button className="btn ghost" type="button" onClick={quickFillB}>Quick fill</button>
                </div>
                <div className="chip-row">
                  {lineupB.map((e) => (
                    <span key={e.id} className="chip removable">
                      {e.name}
                      <button className="chip-remove" type="button" onClick={() => removeB(e.id)} aria-label="remove">×</button>
                    </span>
                  ))}
                </div>
                <div className="paper-tabs" role="tablist">
                  <button role="tab" className={modeB === 'name' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeB('name')}>By name</button>
                  <button role="tab" className={modeB === 'number' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeB('number')}>Search by mobile</button>
                  {teams.length > 0 && (
                    <button role="tab" className={modeB === 'team' ? 'paper-tab active' : 'paper-tab'} type="button" onClick={() => setModeB('team')}>By team</button>
                  )}
                </div>
                {modeB === 'name' ? (
                  <div className="add-row">
                    <input value={nameB} onChange={(e) => setNameB(e.target.value)} placeholder="Player name" />
                    <button className="btn" type="button" onClick={addByNameB} disabled={!nameB.trim()}>Add</button>
                  </div>
                ) : modeB === 'number' ? (
                  <div className="add-col">
                    <input type="tel" inputMode="numeric" pattern="[0-9]*" value={numB} onChange={(e) => setNumB(e.target.value.replace(/\D/g, ''))} placeholder="Mobile number (last 10 digits, min 8)" />
                    <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Searches your directory by mobile number</p>
                    {searchingB && <p className="muted">Searching...</p>}
                    {resultsB.length > 0 && (
                      <div className="suggestions">
                        {resultsB.map((p) => (
                          <button key={p.id} className="suggestion" type="button" onClick={() => addDirectoryB(p)}>
                            {p.name} {p.is_guest ? '· Guest' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    {numB.length >= 4 && !searchingB && resultsB.length === 0 && (
                      <div className="create-new">
                        <p className="muted">No results for '{numB}'</p>
                        <button className="btn ghost" type="button" onClick={() => setShowCreateB((v) => !v)}>Add '{numB}' as new player</button>
                        {showCreateB && (
                          <div className="add-row">
                            <input value={newNameB} onChange={(e) => setNewNameB(e.target.value)} placeholder="Player name" />
                            <button className="btn" type="button" onClick={() => void createNewB()} disabled={creatingB || !newNameB.trim()}>
                              {creatingB ? 'Creating...' : 'Create'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="add-col">
                    {teamsLoading ? (
                      <p className="muted" style={{ textAlign: 'center', padding: 16 }}>Loading teams…</p>
                    ) : teams.length === 0 ? (
                      <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No teams yet. <a href="#/teams" onClick={(e) => { e.preventDefault(); window.location.hash = '#/teams'; }}>Create a team first</a>.</p>
                    ) : (
                      <div className="team-picker">
                        {teams.map(t => (
                          <button
                            key={t.id}
                            className={`team-option ${selectedTeamB === t.id ? 'selected' : ''}`}
                            type="button"
                            onClick={() => void importTeamRoster(t.id, false)}
                            disabled={importingTeamB}
                            style={{ borderColor: t.colour }}
                          >
                            <span className="team-option-colour" style={{ background: t.colour }} />
                            <span className="team-option-name">{t.name}</span>
                            <span className="team-option-short">({t.short_name})</span>
                            {importingTeamB && selectedTeamB === t.id && <span className="muted">Importing…</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="error">{error}</p>}

              <div className="wizard-actions">
                <button className="btn ghost" type="button" onClick={() => setWizardStep(1)}>Back</button>
                <button className="btn accent wide" type="submit" disabled={busy} style={{ flex: 1 }}>
                  {busy ? 'Creating...' : 'Create match'}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
