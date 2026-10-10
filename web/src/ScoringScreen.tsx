import { useMemo, useState } from 'react'
import type { Dismissal, LiveScore, MatchState } from '@cricket-app/core'
import { api, ApiRequestError } from './api'
import { useMatch } from './useMatch'
import { ScorecardView } from './ScorecardView'
import { EXTRA_GROUPS, buildBallPayload, formatBowlerFigures, formatWin, parseOvers, playerName, requiresFielder, resolvePositions } from './scoring'
import type { BallKind } from './scoring'

const DISMISSALS: Dismissal[] = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'RUN_OUT',
  'STUMPED',
  'HIT_WICKET',
  'OBSTRUCTING',
]

const BATTING_STATUSES = new Set(['IN_PROGRESS', 'INNINGS_BREAK'])

interface Props {
  matchId: string
  onLeave: () => void
}

export function ScoringScreen({ matchId, onLeave }: Props) {
  const { bundle, error } = useMatch(matchId)
  const [tab, setTab] = useState<'scoring' | 'scorecard'>('scoring')
  const [strikerPick, setStrikerPick] = useState('')
  const [nonStrikerPick, setNonStrikerPick] = useState('')
  const [bowlerPick, setBowlerPick] = useState('')
  const [wicketMode, setWicketMode] = useState(false)
  const [selectedDismissal, setSelectedDismissal] = useState<Dismissal | null>(null)
  const [fielderPick, setFielderPick] = useState('')
  const [padError, setPadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const state = bundle?.state ?? null
  const live = bundle?.live ?? null

  // New innings: forget the previous innings' opener/bowler picks.
  const inningsIndex = live?.inningsIndex ?? 0
  const [seenInnings, setSeenInnings] = useState(inningsIndex)
  if (inningsIndex !== seenInnings) {
    setSeenInnings(inningsIndex)
    setStrikerPick('')
    setNonStrikerPick('')
    setBowlerPick('')
    setSelectedDismissal(null)
    setFielderPick('')
  }

  const teamIds = useMemo(() => {
    if (!state) return { batting: [] as string[], bowling: [] as string[] }
    const cfg = state.config
    const battingKey = live?.battingTeamId === cfg.teamBId ? 'B' : 'A'
    const bowlingKey = battingKey === 'A' ? 'B' : 'A'
    return { batting: cfg.lineups[battingKey], bowling: cfg.lineups[bowlingKey] }
  }, [state, live?.battingTeamId])

  if (!bundle || !state || !live) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Cricket Scorer</h1>
          <button className="btn ghost" onClick={onLeave}>
            ← Home
          </button>
        </header>
        <main className="card">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</main>
      </div>
    )
  }

  const inningsNotStarted = live.striker == null || live.nonStriker == null
  const positions = resolvePositions(live, {
    strikerId: strikerPick,
    nonStrikerId: nonStrikerPick,
    bowlerId: bowlerPick,
  })
  const padEnabled =
    BATTING_STATUSES.has(live.status) &&
    positions.strikerId !== '' &&
    positions.nonStrikerId !== '' &&
    positions.bowlerId !== '' &&
    !busy

  async function submitBall(kind: BallKind, runs: number, dismissal?: Dismissal, fielderId?: string): Promise<void> {
    if (!live) return
    setPadError(null)
    setBusy(true)
    try {
      const { over, ball } = parseOvers(live.oversText)
      const payload = buildBallPayload({
        kind,
        runs,
        ...(dismissal ? { dismissal } : {}),
        ...(fielderId ? { fielderId } : {}),
        positions,
        over,
        ball,
      })
      await api.postEvent(matchId, payload)
      setWicketMode(false)
      setSelectedDismissal(null)
      setFielderPick('')
    } catch (e) {
      if (e instanceof ApiRequestError) setPadError(e.message)
      else setPadError(e instanceof Error ? e.message : 'Failed to record ball')
    } finally {
      setBusy(false)
    }
  }

  function selectDismissal(d: Dismissal): void {
    setSelectedDismissal(d)
    setFielderPick(d === 'STUMPED' || d === 'OBSTRUCTING' ? (teamIds.bowling[0] ?? '') : '')
  }

  function cancelWicket(): void {
    setWicketMode(false)
    setSelectedDismissal(null)
    setFielderPick('')
  }

  function startWicket(): void {
    setSelectedDismissal(null)
    setFielderPick('')
    setWicketMode(true)
  }

  const resultText =
    bundle.result?.kind === 'WINNER'
      ? formatWin(bundle.result)
      : bundle.result?.kind === 'TIE'
        ? 'Match tied'
        : bundle.result?.kind === 'ABANDONED'
          ? `Match abandoned${bundle.result.reason ? `: ${bundle.result.reason}` : ''}`
          : null

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>
            {state.config.teamAId} vs {state.config.teamBId}
          </h1>
          <p className="muted">
            {state.config.oversPerInnings} overs · {live.status.replace('_', ' ').toLowerCase()}
          </p>
        </div>
        <button className="btn ghost" onClick={onLeave}>
          ← Home
        </button>
      </header>

      {resultText && <div className={`banner ${bundle.result?.kind === 'ABANDONED' ? 'warn' : 'accent'}`}>{resultText}</div>}
      {error && <div className="banner warn">{error}</div>}

      <nav className="tabs">
        <button className={tab === 'scoring' ? 'tab active' : 'tab'} onClick={() => setTab('scoring')}>
          Scoring
        </button>
        <button className={tab === 'scorecard' ? 'tab active' : 'tab'} onClick={() => setTab('scorecard')}>
          Scorecard
        </button>
      </nav>

      {tab === 'scoring' ? (
        <>
          <section className="card live-card">
            <div className="score-line">
              <span className="score">
                {live.runs}-{live.wickets}
              </span>
              <span className="overs">({live.oversText} ov)</span>
            </div>
            <div className="live-meta">
              <span>CRR {live.runRate.toFixed(2)}</span>
              {live.target != null && (
                <span>
                  Target {live.target} · need {Math.max(0, live.target - live.runs)} off {live.ballsRemaining}
                  {live.requiredRunRate != null && ` · RRR ${live.requiredRunRate.toFixed(2)}`}
                </span>
              )}
            </div>
            {live.thisOver.length > 0 && (
              <div className="this-over">
                <span className="muted">This over:</span>
                {live.thisOver.map((b, i) => (
                  <span key={i} className={`chip ${b.wicket ? 'danger' : b.runs >= 4 ? 'accent' : ''}`}>
                    {b.text}
                  </span>
                ))}
              </div>
            )}
            <div className="players">
              <div className="player">
                <span className="muted">Strike</span>
                <strong>{live.striker ? playerName(state.config, live.striker.playerId) : '—'}</strong>
                <span>
                  {live.striker ? `${live.striker.runs} (${live.striker.balls})` : ''}
                </span>
              </div>
              <div className="player">
                <span className="muted">Non-strike</span>
                <strong>{live.nonStriker ? playerName(state.config, live.nonStriker.playerId) : '—'}</strong>
                <span>
                  {live.nonStriker ? `${live.nonStriker.runs} (${live.nonStriker.balls})` : ''}
                </span>
              </div>
              <div className="player">
                <span className="muted">Bowler</span>
                <strong>{playerName(state.config, live.bowler?.playerId ?? bowlerPick) || '—'}</strong>
                <span>
                  {live.bowler
                    ? formatBowlerFigures(live.bowler.balls, live.bowler.runs, live.bowler.wickets)
                    : ''}
                </span>
              </div>
            </div>
          </section>

          {inningsNotStarted && BATTING_STATUSES.has(live.status) && (
            <section className="card">
              <h2>New innings</h2>
              <p className="muted">Pick the openers and the opening bowler.</p>
              <div className="field-row">
                <label>
                  Striker
                  <select value={strikerPick} onChange={(e) => setStrikerPick(e.target.value)}>
                    <option value="">Select…</option>
                    {teamIds.batting
                      .filter((p) => p !== nonStrikerPick)
                      .map((p) => (
                        <option key={p} value={p}>
                          {playerName(state.config, p)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Non-striker
                  <select value={nonStrikerPick} onChange={(e) => setNonStrikerPick(e.target.value)}>
                    <option value="">Select…</option>
                    {teamIds.batting
                      .filter((p) => p !== strikerPick)
                      .map((p) => (
                        <option key={p} value={p}>
                          {playerName(state.config, p)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          <section className="card pad">
            {(live.bowler == null || inningsNotStarted) && (
              <label className="bowler-select">
                Bowler
                <select
                  value={bowlerPick}
                  onChange={(e) => setBowlerPick(e.target.value)}
                  disabled={live.bowler != null}
                >
                  <option value="">Select…</option>
                  {teamIds.bowling.map((p) => (
                    <option key={p} value={p}>
                      {playerName(state.config, p)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!wicketMode ? (
              <>
                <div className="pad-grid">
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <button
                      key={r}
                      className="btn pad-btn"
                      disabled={!padEnabled}
                      onClick={() => void submitBall('RUNS', r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="extras-groups">
                  {EXTRA_GROUPS.map((group) => (
                    <div className="extras-group" key={group.label}>
                      <span className="extras-label">{group.label}</span>
                      <div className="pad-grid extras">
                        {group.options.map((option) => (
                          <button
                            key={option.label}
                            className="btn pad-btn"
                            disabled={!padEnabled}
                            onClick={() => void submitBall(option.kind, option.runs)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="extras-group">
                    <span className="extras-label">Wicket</span>
                    <div className="pad-grid extras">
                      <button className="btn pad-btn danger" disabled={!padEnabled} onClick={startWicket}>
                        W
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {selectedDismissal ? (
                  <>
                    <p className="muted">Selected: {selectedDismissal.replace('_', ' ')}</p>
                    {requiresFielder(selectedDismissal) && (
                      <>
                        <p className="muted">Fielder</p>
                        <select
                          value={fielderPick}
                          disabled={busy}
                          onChange={(e) => setFielderPick(e.target.value)}
                        >
                          <option value="">Select fielder</option>
                          {teamIds.bowling.map((p) => (
                            <option key={p} value={p}>
                              {playerName(state.config, p)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <button
                      className="btn pad-btn"
                      onClick={() => submitBall('WICKET', 0, selectedDismissal, fielderPick)}
                      disabled={busy || (requiresFielder(selectedDismissal) && !fielderPick)}
                    >
                      Submit
                    </button>
                    <button className="btn ghost" onClick={cancelWicket}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="pad-grid dismissals">
                      {DISMISSALS.map((d) => (
                        <button
                          key={d}
                          className="btn pad-btn"
                          disabled={busy}
                          onClick={() => void selectDismissal(d)}
                        >
                          {d.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    <button className="btn ghost" onClick={cancelWicket}>
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}

            {padError && <p className="error">{padError}</p>}
          </section>
        </>
      ) : (
        <ScorecardView bundle={bundle} />
      )}
    </div>
  )
}
