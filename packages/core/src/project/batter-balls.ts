import type { MatchEvent } from '../types.js'
import { deliveryBatRuns, effectiveEvents } from '../apply.js'
import { isLegalDelivery } from '../validate.js'

/** One delivery as shown in a batter's ball-by-ball list. */
export interface BatterBall {
  seq: number
  /** Innings-independent address, e.g. "5.3". */
  label: string
  /** Runs scored off the bat on this delivery. */
  runs: number
  /** True when this batter was dismissed on the delivery. */
  wicket: boolean
  /** True for a four or a six off the bat. */
  boundary: boolean
}

/**
 * The ball-by-ball of one batter, oldest delivery first.
 *
 * Reads `effectiveEvents`, so corrections are honoured exactly as the scorecard
 * sees them: a superseded delivery is replaced, not repeated.
 *
 * A delivery is listed when the batter is credited for it, which is the same
 * rule the scorecard uses: every legal delivery the batter faced, plus any
 * delivery they scored runs off the bat (a no-ball with runs). A wide is never
 * listed — the batter did not face it and it is not credited to them.
 *
 * Innings are split with the same rule as the commentary projection: a
 * regression in the (over, ball) address opens a new innings. Pass
 * `inningsIndex` to read a single innings; omit it to read the whole match.
 */
export function projectBatterBalls(
  events: MatchEvent[],
  playerId: string,
  inningsIndex?: number,
): BatterBall[] {
  const balls: BatterBall[] = []
  let innings = 0
  let lastOver: number | null = null
  let lastBall = -1

  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue

    if (lastOver !== null && (event.over < lastOver || (event.over === lastOver && event.ball < lastBall))) {
      innings += 1
      lastOver = null
    }
    if (lastOver === null || event.over !== lastOver) {
      lastOver = event.over
    }
    lastBall = event.ball

    if (inningsIndex !== undefined && innings !== inningsIndex) continue
    if (event.batterId !== playerId) continue

    const runs = deliveryBatRuns(event)
    if (!isLegalDelivery(event.extras) && runs === 0) continue

    const dismissedId = event.dismissedPlayerId ?? event.batterId
    balls.push({
      seq: event.seq,
      label: `${event.over}.${event.ball + 1}`,
      runs,
      wicket: event.wicket && dismissedId === playerId,
      boundary: runs === 4 || runs === 6,
    })
  }

  return balls
}
