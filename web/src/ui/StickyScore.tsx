import type { LiveScore } from '@cricket-app/core'
import { requirementText } from '../scoring'
import { AnimatedNumber } from './AnimatedNumber'

interface StickyScoreProps {
  live: LiveScore
  /** Whether the compact bar is on screen; drives the slide-in. */
  visible: boolean
}

/**
 * A slim, fixed score bar that slides over the top of the Scoring tab once the
 * full live card scrolls out of view. Purely presentational — it duplicates the
 * live card's numbers so the score stays legible while the pad is in use.
 */
export function StickyScore({ live, visible }: StickyScoreProps) {
  const requirement = requirementText(live)
  const isSuperOver = live.status === 'SUPER_OVER'
  const target = live.target

  return (
    <div
      className={`sticky-score${visible ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      aria-label="Live score"
    >
      <div className="sticky-score-inner">
        <span className="sticky-score-score">
          <AnimatedNumber value={live.runs} />-<AnimatedNumber value={live.wickets} />
        </span>
        <span className="sticky-score-overs">({live.oversText} ov)</span>
        <span className="sticky-score-rates">
          <span>CRR {live.runRate.toFixed(2)}</span>
          {live.requiredRunRate != null && <span>RRR {live.requiredRunRate.toFixed(2)}</span>}
        </span>
        {isSuperOver && target != null && (
          <span className="sticky-score-need super-over">
            Super Over Target: {target} · {live.battingTeamId} need {Math.max(0, target - live.runs)} off {live.ballsRemaining} balls
          </span>
        )}
        {!isSuperOver && requirement && <span className="sticky-score-need">{requirement}</span>}
      </div>
    </div>
  )
}
