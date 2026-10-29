import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { myMatchIds, clearMyMatches } from './myMatches'
import { getSupabase } from './supabase'
import type { MatchSummary } from './match'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { playScoreBlip } from './ui/beep'
import { ThemeToggle } from './ui/ThemeToggle'

import type { CSSProperties } from 'react'

interface MatchCardProps {
  summary: MatchSummary
  onOpen: (matchId: string) => void
  style?: CSSProperties
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (matchId: string) => void
}

const STATUS_ICON: Record<MatchSummary['status'], string> = {
  UPCOMING: '⏰',
  LIVE: '🔴',
  BREAK: '⏸️',
  DONE: '✅',
}

/** Splits "148-3 (16.2 ov)" into its leading run count and the remaining text. */
function splitScore(score: string): { runs: number; rest: string } | null {
  const match = /^(\d+)(.*)$/.exec(score)
  if (!match) return null
  return { runs: Number(match[1]), rest: match[2] ?? '' }
}

export function MatchCard({ summary, onOpen, style, selectMode, selected, onToggleSelect }: MatchCardProps) {
  const prevScore = useRef<string | null>(null)
  const parsed = summary.score ? splitScore(summary.score) : null

  useEffect(() => {
    // Beep only when an existing score actually changes, never on first paint.
    if (prevScore.current !== null && prevScore.current !== summary.score) {
      playScoreBlip()
    }
    prevScore.current = summary.score
  }, [summary.score])

  if (selectMode) {
    return (
      <label
        className={`card match-card animate ${selected ? 'is-selected' : ''}`}
        style={style}
        data-tooltip={summary.statusText}
      >
        <input
          type="checkbox"
          className="match-select"
          checked={selected ?? false}
          onChange={() => onToggleSelect?.(summary.matchId)}
        />
        <span className="match-teams">{summary.label}</span>
        <span className={`pill ${summary.status.toLowerCase()}`}>
          <span className="pill-icon" aria-hidden="true">
            {STATUS_ICON[summary.status]}
          </span>
          {summary.statusText}
        </span>
        {summary.score && (
          <span className="match-score">
            {parsed ? (
              <>
                <AnimatedNumber value={parsed.runs} />
                {parsed.rest}
              </>
            ) : (
              summary.score
            )}
          </span>
        )}
        {summary.resultText && <span className="muted match-result">{summary.resultText}</span>}
      </label>
    )
  }

  return (
    <button
      type="button"
      className="card match-card animate"
      style={style}
      onClick={() => onOpen(summary.matchId)}
      data-tooltip={summary.statusText}
      aria-label={`${summary.label} — ${summary.statusText}`}
    >
      <span className="match-teams">{summary.label}</span>
      <span className={`pill ${summary.status.toLowerCase()}`}>
        <span className="pill-icon" aria-hidden="true">
          {STATUS_ICON[summary.status]}
        </span>
        {summary.statusText}
      </span>
      {summary.score && (
        <span className="match-score">
          {parsed ? (
            <>
              <AnimatedNumber value={parsed.runs} />
              {parsed.rest}
            </>
          ) : (
            summary.score
          )}
        </span>
      )}
      {summary.resultText && <span className="muted match-result">{summary.resultText}</span>}
      {typeof summary.progress === 'number' && summary.score && (
        <span className="match-progress" aria-hidden="true">
          <span className="match-progress-fill" style={{ width: `${Math.round(summary.progress * 100)}%` }} />
        </span>
      )}
    </button>
  )
}

export interface HomeBoardProps {
  liveNow: MatchSummary[]
  mine: MatchSummary[]
  error: string | null
  loading: boolean
  signedIn: boolean
  isAdmin: boolean
  selectMode: boolean
  selected: Set<string>
  onNew: () => void
  onRefresh: () => void
  onOpen: (matchId: string) => void
  onToggleSelect: (matchId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onDeleteAll: () => void
  onLogout: () => void
  deleting: boolean
  onEnterSelectMode: () => void
  onExitSelectMode: () => void
}

function Section(props: {
  title: string
  empty: string
  matches: MatchSummary[]
  onOpen: (matchId: string) => void
  selectMode: boolean
  selected: Set<string>
  onToggleSelect: (matchId: string) => void
}) {
  return (
    <section className="board-section">
      <h2>{props.title}</h2>
      {props.matches.length === 0 ? (
        <p className="muted">{props.empty}</p>
      ) : (
        <div className="board-list">
          {props.matches.map((summary, i) => (
            <MatchCard
              key={summary.matchId}
              summary={summary}
              onOpen={props.onOpen}
              style={{ animationDelay: `${i * 0.06}s` }}
              selectMode={props.selectMode}
              selected={props.selected.has(summary.matchId)}
              onToggleSelect={props.onToggleSelect}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomeBoard({
  liveNow,
  mine,
  error,
  loading,
  signedIn,
  isAdmin,
  selectMode,
  selected,
  onNew,
  onRefresh,
  onOpen,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onDeleteAll,
  onLogout,
  deleting,
  onEnterSelectMode,
  onExitSelectMode,
}: HomeBoardProps) {
  const allMatches = [...liveNow, ...mine]
  const selectedCount = selected.size

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Cricket Scorer</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn accent" onClick={onNew}>
            + New match
          </button>
          {signedIn && (
            <>
              {isAdmin && (
                <>
                  {selectMode ? (
                    <>
                      <button className="btn ghost" onClick={onSelectAll}>
                        Select all
                      </button>
                      <button className="btn ghost" onClick={onClearSelection} disabled={selectedCount === 0}>
                        Clear
                      </button>
                      <button className="btn danger" onClick={onDeleteSelected} disabled={deleting || selectedCount === 0}>
                        {deleting ? 'Deleting…' : `Delete selected (${selectedCount})`}
                      </button>
                      <button className="btn danger" onClick={onDeleteAll} disabled={deleting || allMatches.length === 0}>
                        {deleting ? 'Deleting…' : 'Delete all'}
                      </button>
                      <button className="btn ghost" onClick={onExitSelectMode} disabled={deleting}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn ghost" onClick={onEnterSelectMode}>
                      Select matches
                    </button>
                  )}
                </>
              )}
              <button className="btn ghost" onClick={onLogout}>
                Logout
              </button>
            </>
          )}
          {!signedIn && (
            <a className="btn ghost" href="#/signin">
              Sign in
            </a>
          )}
          {signedIn && (
            <a className="btn ghost" href="#/settings">
              Settings
            </a>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="board">
        {error && <div className="banner warn">{error}</div>}
        {loading && liveNow.length === 0 && mine.length === 0 && <p className="muted">Loading matches…</p>}
        <Section
          title="Live now"
          empty="Nothing being played right now."
          matches={liveNow}
          onOpen={onOpen}
          selectMode={selectMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
        />
        <Section
          title="Your matches"
          empty="No matches on this device yet."
          matches={mine}
          onOpen={onOpen}
          selectMode={selectMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
        />
      </main>
    </div>
  )
}

export function HomeScreen({ onNewMatch, onOpenMatch }: { onNewMatch: () => void; onOpenMatch: (matchId: string) => void }) {
  const [liveNow, setLiveNow] = useState<MatchSummary[]>([])
  const [mine, setMine] = useState<MatchSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [signedIn, setSignedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  // Track signed-in state and admin status.
  useEffect(() => {
    let alive = true
    const supabase = getSupabase()
    const check = async (): Promise<void> => {
      try {
        const { data } = await supabase.auth.getUser()
        if (alive) {
          setSignedIn(Boolean(data.user))
          setIsAdmin(data.user?.email === 'adityanaik.12d@gmail.com')
        }
      } catch {
        if (alive) {
          setSignedIn(false)
          setIsAdmin(false)
        }
      }
    }
    void check()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        setSignedIn(Boolean(session?.user))
        setIsAdmin(session?.user?.email === 'adityanaik.12d@gmail.com')
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      try {
        const [board, own] = await Promise.all([
          api.listMatches(),
          api.listMatches({ ids: myMatchIds() }),
        ])
        if (!alive) return
        setLiveNow(board.filter((m) => m.status === 'LIVE' || m.status === 'BREAK'))
        setMine(own)
        setError(null)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load matches')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [reload])

  const handleDeleteAll = useCallback(async (): Promise<void> => {
    if (!window.confirm('Delete ALL matches? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.deleteAllMyMatches()
      clearMyMatches()
      setSelected(new Set())
      setSelectMode(false)
      setReload((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete matches')
    } finally {
      setDeleting(false)
    }
  }, [])

  const handleToggleSelect = useCallback((matchId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((): void => {
    const all = [...liveNow, ...mine].map((m) => m.matchId)
    setSelected(new Set(all))
  }, [liveNow, mine])

  const handleClearSelection = useCallback((): void => {
    setSelected(new Set())
  }, [])

  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} selected match(es)? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.deleteMatches([...selected])
      clearMyMatches()
      setSelected(new Set())
      setSelectMode(false)
      setReload((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete matches')
    } finally {
      setDeleting(false)
    }
  }, [selected])

  const handleEnterSelectMode = useCallback((): void => {
    setSelectMode(true)
    setSelected(new Set())
  }, [])

  const handleExitSelectMode = useCallback((): void => {
    setSelectMode(false)
    setSelected(new Set())
  }, [])

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await api.signOut()
      clearMyMatches()
      setSignedIn(false)
      setSelected(new Set())
      setSelectMode(false)
      setReload((n) => n + 1)
    } catch {
      // Even if signOut fails locally, clear local state
      clearMyMatches()
      setSignedIn(false)
      setSelected(new Set())
      setSelectMode(false)
      setReload((n) => n + 1)
    }
  }, [])

  // Any change to any match row re-reads the board.
  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel('home-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  return (
    <HomeBoard
      liveNow={liveNow}
      mine={mine}
      error={error}
      loading={loading}
      signedIn={signedIn}
      selectMode={selectMode}
      selected={selected}
      onNew={onNewMatch}
      onRefresh={refresh}
      onOpen={onOpenMatch}
      onToggleSelect={handleToggleSelect}
      onSelectAll={handleSelectAll}
      onClearSelection={handleClearSelection}
      onDeleteSelected={handleDeleteSelected}
      onDeleteAll={handleDeleteAll}
      onLogout={handleLogout}
      deleting={deleting}
      onEnterSelectMode={handleEnterSelectMode}
      onExitSelectMode={handleExitSelectMode}
      isAdmin={isAdmin}
    />
  )
}
