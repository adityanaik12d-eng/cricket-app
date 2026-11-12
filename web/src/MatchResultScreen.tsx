import { useMemo, useState, useEffect } from 'react'
import { applyEvents } from '@cricket-app/core'
import type { MatchConfig, MatchResult, InningsCard, Scorecard, MatchEvent, MatchState } from '@cricket-app/core'
import { formatWin, playerName, topBowler, topScorer } from './scoring'
import { HomeIcon } from './ui/HomeIcon'
import { pickPlayerOfMatch } from './mvp'
import { AnimatedCounter } from './ui/AnimatedCounter'

import { ScorecardView } from './ScorecardView'

interface Props {
  config: MatchConfig
  scorecard: Scorecard
  result: MatchResult
  events?: MatchEvent[]
  onHome: () => void
}

/** Full-screen match result view shown when match is completed. */
export function MatchResultScreen({ config, scorecard, result, events, onHome }: Props) {

  if (!result) return null

  const isWinner = result.kind === 'WINNER' || result.kind === 'SUPER_OVER_WINNER'
  const winnerTeamId = isWinner ? result.teamId : null
  const loserTeamId = winnerTeamId === config.teamAId ? config.teamBId : config.teamAId

  const winnerInnings = scorecard.innings.find((inn) => inn.battingTeamId === winnerTeamId && inn.closed)
  const loserInnings = scorecard.innings.find((inn) => inn.battingTeamId === loserTeamId && inn.closed)

  const state = events && events.length > 0 ? applyEvents(config, events) : null

  const potm = useMemo(() => {
    try {
      const impacts = new Map<string, any>()
      const ensure = (playerId: string, teamName: string) => {
        if (!impacts.has(playerId)) impacts.set(playerId, { playerId, playerName: playerName(config, playerId), teamName, runs: 0, balls: 0, fours: 0, sixes: 0, notOut: true, wickets: 0, overs: 0, runsConceded: 0 })
        return impacts.get(playerId)
      }
      for (const inn of scorecard.innings) {
        const team = inn.battingTeamId
        for (const b of inn.batting ?? []) {
          const p = ensure(b.playerId, team)
          p.runs += b.runs ?? 0; p.balls += b.balls ?? 0; p.fours += b.fours ?? 0; p.sixes += b.sixes ?? 0
          if (b.out) p.notOut = false
        }
        for (const bw of inn.bowling ?? []) {
          // bowler belongs to bowling team; best-effort: not batting team
          const bowlTeam = team === config.teamAId ? config.teamBId : config.teamAId
          const p = ensure(bw.playerId, bowlTeam)
          p.wickets += bw.wickets ?? 0; p.runsConceded += bw.runs ?? 0
          const ov = typeof (bw as any).overs === 'number' ? (bw as any).overs : parseFloat(String((bw as any).oversText ?? '0').replace(/[^0-9.]/g, '')) || 0
          p.overs += ov
        }
      }
      return pickPlayerOfMatch(Array.from(impacts.values()))
    } catch {
      return null
    }
  }, [config, scorecard])

  // Show victory stamp animation on mount
  const [showStamp, setShowStamp] = useState(true)
  const [showPoster, setShowPoster] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowStamp(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="result-screen ms-reveal page-shake">
      {/* Victory Stamp Animation */}
      {showStamp && (
        <div className={`victory-stamp ${isWinner ? 'winner' : result.kind === 'TIE' ? 'tied' : ''}`}>
          <div className="victory-stamp-inner">
            <span>{isWinner ? 'VICTORY' : result.kind === 'TIE' ? 'MATCH TIED' : 'MATCH ABANDONED'}</span>
            {isWinner && <span className="muted" style={{fontSize: '0.7em', fontWeight: 400}}>{winnerTeamId} WIN</span>}
          </div>
        </div>
      )}

      <header className="result-header">
        <div className="result-badge">
          {result.kind === 'SUPER_OVER_WINNER' ? 'Superover' : 'Match'}
          {' '}Complete
        </div>
        <h1 className="result-headline">
          {isWinner
            ? formatWin(result as { kind: 'WINNER' | 'SUPER_OVER_WINNER'; teamId: string; by: 'RUNS' | 'WICKETS'; amount: number })
            : result.kind === 'TIE'
              ? 'Match Tied'
              : `Match Abandoned${result.reason ? `: ${result.reason}` : ''}`}
        </h1>
      </header>

      <main className="result-main">
        {isWinner && winnerInnings && loserInnings && (
          <div className="result-innings-comparison">
            <div className="result-innings winner ms-stat-card" style={{ padding: 14 }}>
              <div className="result-team-name">{winnerInnings.battingTeamId}</div>
              <div className="result-score"><AnimatedCounter value={winnerInnings.runs} />-{winnerInnings.wickets}</div>
              <div className="result-overs">({winnerInnings.oversText} ov) · RR {winnerInnings.runRate.toFixed(2)}</div>
            </div>
            <div className="result-vs">vs</div>
            <div className="result-innings loser ms-stat-card" style={{ padding: 14 }}>
              <div className="result-team-name">{loserInnings.battingTeamId}</div>
              <div className="result-score"><AnimatedCounter value={loserInnings.runs} />-{loserInnings.wickets}</div>
              <div className="result-overs">({loserInnings.oversText} ov) · RR {loserInnings.runRate.toFixed(2)}</div>
            </div>
          </div>
        )}

        {potm && potm.points > 0 && (
          <section className="card ms-stat-card" style={{ marginBottom: 12 }}>
            <h2 style={{ marginTop: 0 }}>Player of the Match (MVP)</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{potm.playerName}</div>
                <div className="muted">{potm.teamName}</div>
              </div>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary, #7F011F)' }}><AnimatedCounter value={potm.points} decimals={2} /> MVP</div>
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              {[
                (potm.runs ?? 0) > 0 ? `${potm.runs}${potm.notOut ? '*' : ''} (${potm.balls ?? 0})` : null,
                (potm.wickets ?? 0) > 0 ? `${potm.wickets} wkts` : null,
              ].filter(Boolean).join(' · ') || 'Impact performance'}
            </div>
          </section>
        )}

        {result.kind === 'TIE' && scorecard.innings.length >= 2 && (
          <div className="result-innings-comparison tie">
            {scorecard.innings.map((inn) => (
              <div key={inn.index} className="result-innings ms-stat-card" style={{ padding: 14 }}>
                <div className="result-team-name">{inn.battingTeamId}</div>
                <div className="result-score"><AnimatedCounter value={inn.runs} />-{inn.wickets}</div>
                <div className="result-overs">({inn.oversText} ov) · RR {inn.runRate.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        <section className="card result-details">
          {scorecard.innings.map((inn) => (
            <div key={inn.index} className="result-innings-detail">
              <h2>{inn.battingTeamId}</h2>
              <div className="result-innings-summary">
                <span>{inn.runs}-{inn.wickets}</span>
                <span>({inn.oversText} ov)</span>
                <span>RR {inn.runRate.toFixed(2)}</span>
              </div>
              <div className="result-top-performers">
                {(() => {
                  const bat = topScorer(inn)
                  const bowl = topBowler(inn)
                  return (
                    <>
                      {bat && (
                        <div className="performer">
                          <span className="performer-label">Top Score:</span>
                          <span className="performer-value">
                            <strong>{playerName(config, bat.playerId)}</strong> {bat.runs} ({bat.balls}b)
                          </span>
                        </div>
                      )}
                      {bowl && (
                        <div className="performer">
                          <span className="performer-label">Best Bowling:</span>
                          <span className="performer-value">
                            <strong>{playerName(config, bowl.playerId)}</strong> {bowl.wickets}-{bowl.runs} ({bowl.oversText} ov)
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          ))}
        </section>

        {/* Share as Poster Button */}
        <section className="card" style={{ marginBottom: 16 }}>
          <button className="btn accent wide" onClick={() => setShowPoster(true)}>
            📸 Share as Poster
          </button>
        </section>

        {state && events && (
          <section className="card">
            <h2>Full Scorecard</h2>
            <ScorecardView bundle={{ state, scorecard }} events={events} />
          </section>
        )}
      </main>

      <footer className="result-footer">
        <button className="btn accent result-home-btn" onClick={onHome}>
          <HomeIcon size={20} />
          Home
        </button>
      </footer>

      {/* Match Poster Modal */}
      {showPoster && (
        <div className="modal-overlay" onClick={() => setShowPoster(false)}>
          <div className="modal match-poster" onClick={(e) => e.stopPropagation()}>
            <header className="poster-header">
              <h1 className="poster-title">{config.teamAId} vs {config.teamBId}</h1>
              <p className="poster-subtitle">{config.oversPerInnings} overs per side</p>
              <div className="poster-score">
                <span className="poster-runs">{isWinner ? winnerInnings?.runs ?? 0 : scorecard.innings[0]?.runs ?? 0}</span>
                <span className="poster-wickets">/{isWinner ? winnerInnings?.wickets ?? 0 : scorecard.innings[0]?.wickets ?? 0}</span>
                <span className="poster-overs">({isWinner ? winnerInnings?.oversText ?? '' : scorecard.innings[0]?.oversText ?? ''} ov)</span>
              </div>
            </header>
            <div className="poster-body">
              <div className="poster-batting">
                <h3 className="poster-section-title">Batting</h3>
                {scorecard.innings.map((inn) => (
                  <div key={inn.index}>
                    <strong>{inn.battingTeamId}</strong>
                    {inn.batting.map((b) => (
                      <div className="poster-batter" key={b.playerId}>
                        <span className="poster-batter-name">{playerName(config, b.playerId)}{b.out ? '' : ' *'}</span>
                        <span className="poster-batter-stats">{b.runs} ({b.balls}b, {b.fours}×4, {b.sixes}×6)</span>
                      </div>
                    ))}
                    <div className="poster-batter">
                      <span>Extras</span>
                      <span className="poster-batter-stats">{inn.extras}</span>
                    </div>
                    <div className="poster-batter">
                      <strong>Total</strong>
                      <strong className="poster-batter-stats">{inn.runs}/{inn.wickets} ({inn.oversText} ov)</strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="poster-bowling">
                <h3 className="poster-section-title">Bowling</h3>
                {scorecard.innings.map((inn) => (
                  <div key={inn.index}>
                    <strong>{inn.bowlingTeamId || (inn.battingTeamId === config.teamAId ? config.teamBId : config.teamAId)}</strong>
                    {inn.bowling.map((b) => (
                      <div className="poster-batter" key={b.playerId}>
                        <span className="poster-batter-name">{playerName(config, b.playerId)}</span>
                        <span className="poster-batter-stats">{b.oversText}-{b.maidens ?? 0}-{b.runs}-{b.wickets} (Econ {b.economy.toFixed(2)})</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <footer className="poster-footer">
              Cricket Scorer · Living Scorebook
            </footer>
            <div className="modal-actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={() => setShowPoster(false)}>Close</button>
              <button className="btn accent" onClick={() => {
                // Download poster as image (would use html2canvas or similar)
                setShowPoster(false)
              }}>Download PNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
