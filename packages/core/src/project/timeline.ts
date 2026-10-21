import type { BallEvent, Dismissal, Extra, MatchConfig, MatchEvent } from '../types.js'
import { deliveryLabel, deliveryRuns, effectiveEvents } from '../apply.js'

/** One delivery as shown on the over timeline. */
export interface TimelineBall {
  seq: number
  over: number
  ball: number
  /** Innings-independent address, e.g. "5.3". */
  label: string
  /** Chip text, e.g. "4", "wd", "W", "nb2". */
  text: string
  runs: number
  wicket: boolean
  extras: Extra
  dismissal: Dismissal | null
  batterId: string
  bowlerId: string
}

/** Every delivery of a single over, in the order they were bowled. */
export interface TimelineOver {
  /** 0-based innings index — matches `LiveScore.inningsIndex`. */
  innings: number
  over: number
  label: string
  balls: TimelineBall[]
  runs: number
  wickets: number
}

function toBall(event: BallEvent, config: MatchConfig): TimelineBall {
  return {
    seq: event.seq,
    over: event.over,
    ball: event.ball,
    label: `${event.over}.${event.ball + 1}`,
    text: deliveryLabel(event, config),
    runs: deliveryRuns(event, config),
    wicket: event.wicket,
    extras: event.extras,
    dismissal: event.dismissal,
    batterId: event.batterId,
    bowlerId: event.bowlerId,
  }
}

/**
 * Groups the deliveries of a match into overs. Reads `effectiveEvents`, so
 * corrections are honoured exactly as the scorecard sees them.
 *
 * Overs come back in the order they were bowled. An innings is split by the same
 * proven rule as the commentary projection: whenever the (over, ball) address
 * regresses, a new innings has started. This copes with wides/no-balls (which do
 * not advance the ball counter) and with the second innings restarting at 0.0.
 */
export function projectTimeline(config: MatchConfig, events: MatchEvent[]): TimelineOver[] {
  const overs: TimelineOver[] = []
  let innings = 0
  let lastOver: number | null = null
  let lastBall = -1
  let current: TimelineOver | null = null

  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue

    if (lastOver !== null && (event.over < lastOver || (event.over === lastOver && event.ball < lastBall))) {
      // The address regressed: a new innings has begun.
      innings += 1
      lastOver = null
      current = null
    }

    if (lastOver === null || event.over !== lastOver) {
      current = { innings, over: event.over, label: `Over ${event.over + 1}`, balls: [], runs: 0, wickets: 0 }
      overs.push(current)
      lastOver = event.over
    }
    if (!current) continue

    lastBall = event.ball
    const ball = toBall(event, config)
    current.balls.push(ball)
    current.runs += ball.runs
    if (ball.wicket) current.wickets += 1
  }

  return overs
}
