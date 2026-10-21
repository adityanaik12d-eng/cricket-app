import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { myMatchIds } from './myMatches'
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

export function MatchCard({ summary, onOpen, style }: MatchCardProps) {
  const prevScore = useRef<string | null>(null)
  const parsed = summary.score ? splitScore(summary.score) : null

  useEffect(() => {
    // Beep only when an existing score actually changes, never on first paint.
    if (prevScore.current !== null && prevScore.current !== summary.score) {
      playScoreBlip()
    }
    prevScore.current = summary.score
  }, [summary.score])

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
          {props.matches.map((summary, i) => (
            <MatchCard
              key={summary.matchId}
              summary={summary}
              onOpen={props.onOpen}
              style={{ animationDelay: `${i * 0.06}s` }}
            />
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
          <ThemeToggle />
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
