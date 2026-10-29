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

/** Partnership information for a single batting pair. */
export interface Partnership {
  /** First batter in the partnership (striker at start). */
  strikerId: string
  /** Second batter in the partnership (non-striker at start). */
  nonStrikerId: string
  /** Runs scored by this partnership (off the bat + byes/leg-byes). */
  runs: number
  /** Legal balls faced by this partnership. */
  balls: number
  /** Duration in deliveries (including wides/no-balls). */
  deliveries: number
  /** Whether this is the current active partnership. */
  isCurrent: boolean
  /** Fall of wicket that ended this partnership, if any. */
  fallOfWicket: FallOfWicket | null
  /** Sequence number of the first delivery of this partnership. */
  startSeq: number
  /** Sequence number of the last delivery of this partnership. */
  endSeq: number | null
}

/** Fall of wicket event details. */
export interface FallOfWicket {
  /** Sequence number of the wicket ball. */
  seq: number
  /** Over and ball label (e.g. "12.4"). */
  over: string
  /** Total runs at fall of wicket. */
  runs: number
  /** Wickets fallen at this point. */
  wickets: number
  /** Batter who was dismissed. */
  dismissedPlayerId: string
  /** Type of dismissal. */
  dismissal: Dismissal | null
  /** Bowler who took the wicket (null for run out/obstructing). */
  bowlerId: string | null
  /** Fielder involved (if caught/stumped/run out). */
  fielderId: string | undefined
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

/**
 * Projects partnerships from a match's ball events.
 *
 * Returns partnerships grouped by innings, including the current active partnership
 * and all historical partnerships. Each partnership tracks the batter pair,
 * runs scored, balls faced, duration, and fall-of-wicket details.
 *
 * @param config - Match configuration
 * @param events - All match events (will be corrected via effectiveEvents)
 * @returns Array of partnerships per innings, with current partnership first
 */
export function projectPartnerships(
  config: MatchConfig,
  events: MatchEvent[]
): Partnership[][] {
  const effEvents = effectiveEvents(events)
  const partnershipsByInnings: Partnership[][] = []

  let currentInnings = -1
  let currentPartnership: Partnership | null = null
  let inningsRuns = 0
  let inningsWickets = 0

  for (const event of effEvents) {
    if (event.type !== 'BALL') continue

    // Detect new innings: over/ball address regression
    if (currentInnings === -1 || (event.over === 0 && event.ball === 0 && currentInnings >= 0)) {
      // Finalize previous innings if exists
      if (currentInnings >= 0 && currentPartnership) {
        currentPartnership.endSeq = event.seq - 1
        currentPartnership.isCurrent = false
        const prevInnings = partnershipsByInnings[currentInnings]
        if (prevInnings) prevInnings.push(currentPartnership)
      }

      // Start new innings
      currentInnings += 1
      partnershipsByInnings[currentInnings] = []
      inningsRuns = 0
      inningsWickets = 0
      currentPartnership = null
    }

    const isLegal = event.extras === 'NONE' || event.extras === 'NO_BALL' || event.extras === 'BYE' || event.extras === 'LEG_BYE'

    // Initialize partnership on first ball of innings (or after wicket)
    if (!currentPartnership) {
      const partnershipStartSeq = event.seq
      currentPartnership = {
        strikerId: event.batterId,
        nonStrikerId: event.nonStrikerId ?? '',
        runs: 0,
        balls: 0,
        deliveries: 0,
        isCurrent: true,
        fallOfWicket: null,
        startSeq: partnershipStartSeq,
        endSeq: null,
      }
    }

    // Add runs for this delivery (penalty + bat runs + byes/leg-byes)
    const penalty =
      event.extras === 'WIDE' ? config.wideExtra : event.extras === 'NO_BALL' ? config.noBallExtra : 0
    const batRuns = event.extras === 'NONE' || event.extras === 'NO_BALL' ? event.runs : 0
    const runExtra = event.extras === 'WIDE' || event.extras === 'BYE' || event.extras === 'LEG_BYE' ? event.runs : 0
    const deliveryRuns = penalty + batRuns + runExtra

    if (currentPartnership) {
      currentPartnership.runs += deliveryRuns
      currentPartnership.deliveries += 1
      if (isLegal) {
        currentPartnership.balls += 1
      }
    }
    inningsRuns += deliveryRuns

    // Handle wicket - partnership ends
    if (event.wicket && currentPartnership) {
      inningsWickets += 1
      const dismissedId = event.dismissedPlayerId ?? event.batterId

      // Determine bowler credit (no credit for run out/obstructing)
      const bowlerCredit =
        event.dismissal !== null && event.dismissal !== 'RUN_OUT' && event.dismissal !== 'OBSTRUCTING'

      const fallOfWicket: FallOfWicket = {
        seq: event.seq,
        over: `${event.over}.${event.ball + 1}`,
        runs: inningsRuns,
        wickets: inningsWickets,
        dismissedPlayerId: dismissedId,
        dismissal: event.dismissal,
        bowlerId: bowlerCredit ? event.bowlerId : null,
        fielderId: event.fielderId,
      }

      currentPartnership.fallOfWicket = fallOfWicket
      currentPartnership.endSeq = event.seq
      currentPartnership.isCurrent = false

      const currInnings = partnershipsByInnings[currentInnings]
      if (currInnings) currInnings.push(currentPartnership)

      // Reset for next partnership - will be initialized on next ball
      currentPartnership = null
    }
  }

  // Handle any remaining current partnership at end of events
  if (currentPartnership && currentInnings >= 0) {
    currentPartnership.isCurrent = true
    currentPartnership.endSeq = null
    const currInnings = partnershipsByInnings[currentInnings]
    if (currInnings) currInnings.push(currentPartnership)
  }

  return partnershipsByInnings
}
