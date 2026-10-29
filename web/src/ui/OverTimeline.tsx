import { useMemo, useState } from 'react'
import { projectTimeline } from '@cricket-app/core'
import type { MatchConfig, MatchEvent, TimelineBall } from '@cricket-app/core'
import { playerName } from '../scoring'

/** Chip colour by outcome: wicket red, boundary green, extras amber, dot dimmed. */
export function chipClass(ball: TimelineBall): string {
  if (ball.wicket) return 'chip danger'
  if (ball.extras !== 'NONE') return 'chip warn'
  if (ball.runs === 4 || ball.runs === 6) return 'chip accent'
  if (ball.runs === 0) return 'chip dot'
  return 'chip'
}

const EXTRA_LABEL: Record<string, string> = {
  WIDE: 'wide',
  NO_BALL: 'no ball',
  BYE: 'bye',
  LEG_BYE: 'leg bye',
}

const DISMISSAL_LABEL: Record<string, string> = {
  BOWLED: 'bowled',
  CAUGHT: 'caught',
  LBW: 'lbw',
  RUN_OUT: 'run out',
  STUMPED: 'stumped',
  HIT_WICKET: 'hit wicket',
  OBSTRUCTING: 'obstructing the field',
}

function runs(n: number): string {
  return `${n} ${n === 1 ? 'run' : 'runs'}`
}

/** A human sentence for one delivery, shown when its chip is tapped. */
export function describeBall(config: MatchConfig, ball: TimelineBall): string {
  const base = `${ball.label} · ${playerName(config, ball.bowlerId)} to ${playerName(config, ball.batterId)}`
  if (ball.wicket) {
    const how = ball.dismissal ? (DISMISSAL_LABEL[ball.dismissal] ?? ball.dismissal) : 'out'
    return `${base} · WICKET (${how})`
  }
  if (ball.extras !== 'NONE') {
    return `${base} · ${EXTRA_LABEL[ball.extras] ?? ball.extras}, ${runs(ball.runs)} total`
  }
  if (ball.runs === 0) return `${base} · dot ball`
  if (ball.runs === 4) return `${base} · FOUR`
  if (ball.runs === 6) return `${base} · SIX`
  return `${base} · ${runs(ball.runs)}`
}

/** How many overs of the current innings the timeline shows (newest first). */
export const TIMELINE_OVERS = 6

interface Props {
  config: MatchConfig
  events: MatchEvent[]
  /** 0-based innings index to show (matches `LiveScore.inningsIndex`). */
  innings: number
  /** Called when user wants to edit a ball. Receives the ball's seq. */
  onEdit?: (seq: number) => void
}

/**
 * The ball-by-ball over timeline: the current innings' recent overs, newest
 * first. Each chip is a button; tapping it reveals the delivery's detail line.
 * Only the newest chip animates in (transform/opacity only, reduced-motion safe).
 */
export function OverTimeline({ config, events, innings, onEdit }: Props) {
  const overs = useMemo(
    () => projectTimeline(config, events).filter((over) => over.innings === innings),
    [config, events, innings],
  )
  const [selected, setSelected] = useState<number | null>(null)

  const recent = useMemo(() => overs.slice(-TIMELINE_OVERS).reverse(), [overs])
  const latestSeq = useMemo(() => {
    let max = Number.NEGATIVE_INFINITY
    for (const over of overs) for (const ball of over.balls) if (ball.seq > max) max = ball.seq
    return max
  }, [overs])

  if (overs.length === 0) return null

  const selectedBall =
    selected === null ? null : overs.flatMap((over) => over.balls).find((ball) => ball.seq === selected) ?? null

  return (
    <section className="card timeline" aria-label="Over timeline">
      <div className="timeline-head">
        <h2>Over timeline</h2>
        <span className="muted">{overs.length === 1 ? '1 over' : `${overs.length} overs`}</span>
      </div>
      <div className="timeline-overs">
        {recent.map((over) => (
          <div className="timeline-over" key={`${over.innings}-${over.over}`}>
            <span className="timeline-over-label">{over.label}</span>
            <div className="timeline-balls">
              {over.balls.map((ball) => (
                <button
                  type="button"
                  key={ball.seq}
                  className={`${chipClass(ball)}${ball.seq === latestSeq ? ' ball-in' : ''}`}
                  aria-pressed={ball.seq === selected}
                  aria-label={describeBall(config, ball)}
                  title={describeBall(config, ball)}
                  onClick={() => setSelected((current) => (current === ball.seq ? null : ball.seq))}
                >
                  {ball.text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selectedBall && (
        <div className="timeline-detail-wrapper">
          <p className="timeline-detail">{describeBall(config, selectedBall)}</p>
          {onEdit && (
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={() => onEdit(selectedBall.seq)}
              aria-label={`Edit delivery ${selectedBall.label}`}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </section>
  )
}
