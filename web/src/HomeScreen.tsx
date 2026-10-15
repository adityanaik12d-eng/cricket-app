import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { myMatchIds } from './myMatches'
import { getSupabase } from './supabase'
import type { MatchSummary } from './match'

interface MatchCardProps {
  summary: MatchSummary
  onOpen: (matchId: string) => void
}

export function MatchCard({ summary, onOpen }: MatchCardProps) {
  return (
    <button className="card match-card" onClick={() => onOpen(summary.matchId)}>
      <span className="match-teams">{summary.label}</span>
      <span className={`pill ${summary.status.toLowerCase()}`}>{summary.statusText}</span>
      {summary.score && <span className="match-score">{summary.score}</span>}
      {summary.resultText && <span className="muted match-result">{summary.resultText}</span>}
    </button>
  )
}

export interface HomeBoardProps {
  liveNow: MatchSummary[]
  mine: MatchSummary[]
  error: string | null
  loading: boolean
  onNew: () => void
  onRefresh: () => void
  onOpen: (matchId: string) => void
}

function Section(props: { title: string; empty: string; matches: MatchSummary[]; onOpen: (matchId: string) => void }) {
  return (
    <section className="board-section">
      <h2>{props.title}</h2>
      {props.matches.length === 0 ? (
        <p className="muted">{props.empty}</p>
      ) : (
        <div className="board-list">
          {props.matches.map((summary) => (
            <MatchCard key={summary.matchId} summary={summary} onOpen={props.onOpen} />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomeBoard({ liveNow, mine, error, loading, onNew, onRefresh, onOpen }: HomeBoardProps) {
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
        </div>
      </header>
      <main className="board">
        {error && <div className="banner warn">{error}</div>}
        {loading && liveNow.length === 0 && mine.length === 0 && <p className="muted">Loading matches…</p>}
        <Section title="Live now" empty="Nothing being played right now." matches={liveNow} onOpen={onOpen} />
        <Section title="Your matches" empty="No matches on this device yet." matches={mine} onOpen={onOpen} />
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

  const refresh = useCallback(() => setReload((n) => n + 1), [])

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
      onNew={onNewMatch}
      onRefresh={refresh}
      onOpen={onOpenMatch}
    />
  )
}
