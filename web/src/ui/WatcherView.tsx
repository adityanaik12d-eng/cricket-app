import type { CommentaryLine, LiveScore, MatchConfig, MatchEvent } from '@cricket-app/core'
import type { RefObject } from 'react'
import { formatBowlerFigures, playerName } from '../scoring'
import { OverTimeline } from './OverTimeline'

interface Props {
  config: MatchConfig
  live: LiveScore
  events: MatchEvent[]
  commentary: CommentaryLine[]
  /** Attached to the live score card so the compact score bar can follow it. */
  heroRef?: RefObject<HTMLElement | null>
}

/** The ball of the current over, described for a screen reader. */
export function thisOverLabel(ball: LiveScore['thisOver'][number]): string {
  if (ball.wicket) return `${ball.label}: wicket`
  if (ball.runs === 0) return `${ball.label}: dot ball`
  if (ball.runs === 4) return `${ball.label}: four`
  if (ball.runs === 6) return `${ball.label}: six`
  return `${ball.label}: ${ball.runs} ${ball.runs === 1 ? 'run' : 'runs'}`
}

/** Chip class by outcome, matching the over timeline colours. */
export function thisOverClass(ball: LiveScore['thisOver'][number]): string {
  if (ball.wicket) return 'chip danger'
  if (ball.runs === 4 || ball.runs === 6) return 'chip accent'
  if (ball.runs === 0) return 'chip dot'
  return 'chip'
}

/**
 * The watcher's view of a match: everything a spectator needs and nothing
 * they could change. It is deliberately read-only — there is no button on
 * this screen that writes to the match.
 */
export function WatcherView({ config, live, events, commentary, heroRef }: Props) {
  const recent = commentary.slice(-12).reverse()

  return (
    <div className="watch">
      <section className="card live-card watch-hero" aria-label="Live score" ref={heroRef}>
        <div className="watch-hero-top">
          <span className="watch-badge">Watching</span>
          <span className="muted">
            {live.battingTeamId ?? ''} · {live.inningsIndex === 0 ? 'Innings 1' : `Innings ${live.inningsIndex + 1}`}
          </span>
        </div>
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
        <div className="players">
          <div className="player">
            <span className="muted">Strike</span>
            <strong>{live.striker ? playerName(config, live.striker.playerId) : '—'}</strong>
            <span>{live.striker ? `${live.striker.runs} (${live.striker.balls})` : ''}</span>
          </div>
          <div className="player">
            <span className="muted">Non-strike</span>
            <strong>{live.nonStriker ? playerName(config, live.nonStriker.playerId) : '—'}</strong>
            <span>{live.nonStriker ? `${live.nonStriker.runs} (${live.nonStriker.balls})` : ''}</span>
          </div>
          <div className="player">
            <span className="muted">Bowler</span>
            <strong>{playerName(config, live.bowler?.playerId ?? '') || '—'}</strong>
            <span>
              {live.bowler ? formatBowlerFigures(live.bowler.balls, live.bowler.runs, live.bowler.wickets) : ''}
            </span>
          </div>
        </div>
      </section>

      {live.thisOver.length > 0 && (
        <section className="card watch-over" aria-label="This over">
          <div className="timeline-head">
            <h2>This over</h2>
            <span className="muted">{live.oversText} ov</span>
          </div>
          <div className="timeline-balls">
            {live.thisOver.map((ball) => (
              <span
                key={ball.label}
                className={thisOverClass(ball)}
                aria-label={thisOverLabel(ball)}
                title={thisOverLabel(ball)}
              >
                {ball.text}
              </span>
            ))}
          </div>
        </section>
      )}

      <OverTimeline config={config} events={events} innings={live.inningsIndex} />

      <section className="card watch-commentary" aria-label="Commentary">
        <div className="timeline-head">
          <h2>Commentary</h2>
          <span className="muted">{commentary.length} lines</span>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No commentary yet.</p>
        ) : (
          <ul className="watch-lines">
            {recent.map((line) => (
              <li key={line.seq} className={`watch-line kind-${line.kind.toLowerCase()}`}>
                {line.over && <span className="watch-line-over">{line.over}</span>}
                <span className="watch-line-text">{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
