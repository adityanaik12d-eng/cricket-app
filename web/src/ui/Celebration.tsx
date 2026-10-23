import { useEffect, useRef } from 'react'
import type { DeliveryCelebration } from '@cricket-app/core'

export interface CelebrationProps {
  /** The celebration the delivery earned. `kind: 'none'` renders nothing. */
  celebration: DeliveryCelebration
  /** Called when the overlay should go away. */
  onDone: () => void
  /** How long the overlay stays up, in milliseconds. */
  durationMs?: number
}

/** How long a celebration stays on screen by default. */
export const DEFAULT_CELEBRATION_MS = 1800

/**
 * Arm the auto-dismiss timer for a celebration.
 * Returns the cancel function, which the caller runs on unmount.
 */
export function scheduleCelebrationDismiss(
  onDone: () => void,
  durationMs: number,
  setTimer: (fn: () => void, ms: number) => number = (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (handle: number) => void = (handle) => window.clearTimeout(handle),
): () => void {
  const handle = setTimer(() => onDone(), durationMs)
  return () => clearTimer(handle)
}

/** The effect element that matches the celebration kind. */
function CelebrationEffect({ celebration }: { celebration: DeliveryCelebration }) {
  if (celebration.kind === 'wicket') {
    return (
      <svg className="celebration-stumps" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="14" y="20" width="6" height="34" rx="2" />
        <rect x="29" y="20" width="6" height="34" rx="2" />
        <rect x="44" y="20" width="6" height="34" rx="2" />
        <rect x="22" y="14" width="20" height="4" rx="2" />
        <rect x="24" y="6" width="16" height="4" rx="2" />
      </svg>
    )
  }
  if (celebration.kind === 'six') {
    return <span className="celebration-burst" aria-hidden="true" />
  }
  if (celebration.kind === 'boundary') {
    return <span className="celebration-ripple" aria-hidden="true" />
  }
  if (celebration.kind === 'milestone') {
    return <span className="celebration-badge">{celebration.milestone ?? 0}</span>
  }
  return null
}

/**
 * The overlay that shows on a scoring pad.
 * It animates with transform/opacity only and stays static when the user
 * asked for reduced motion (the stylesheet handles that).
 */
export function Celebration({ celebration, onDone, durationMs = DEFAULT_CELEBRATION_MS }: CelebrationProps) {
  if (celebration.kind === 'none') return null
  return (
    <CelebrationOverlay celebration={celebration} onDone={onDone} durationMs={durationMs} />
  )
}

function CelebrationOverlay({
  celebration,
  onDone,
  durationMs,
}: {
  celebration: DeliveryCelebration
  onDone: () => void
  durationMs: number
}) {
  // Keep the callback fresh without re-arming the timer on every re-render.
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(
    () => scheduleCelebrationDismiss(() => doneRef.current(), durationMs),
    [durationMs, celebration],
  )

  return (
    <div
      className={`celebration celebration-${celebration.kind} celebration-tier-${celebration.tier}`}
      role="status"
      aria-live="polite"
    >
      <CelebrationEffect celebration={celebration} />
      <span className="celebration-label">{celebration.label}</span>
    </div>
  )
}
