import { type KeyboardEvent, type MouseEvent, useRef, useState } from 'react'
import { polarToXY } from '@cricket-app/core'

export const DIAL_SIZE = 220
export const DIAL_CENTER = DIAL_SIZE / 2
export const DIAL_RADIUS = DIAL_SIZE / 2 - 14

/**
 * Pure: turn a point inside the dial into a shot placement.
 * 0 degrees points straight up (down the ground); angles increase clockwise.
 */
export function angleDistanceFromPoint(
  pointX: number,
  pointY: number,
  centerX: number = DIAL_CENTER,
  centerY: number = DIAL_CENTER,
  radius: number = DIAL_RADIUS,
): { angle: number; distance: number } {
  const dx = pointX - centerX
  const dy = pointY - centerY
  const raw = Math.sqrt(dx * dx + dy * dy)
  const distance = radius > 0 ? Math.min(1, raw / radius) : 0
  // -0 would make atan2 report 180 degrees for the centre of the dial.
  const north = dy === 0 ? 0 : -dy
  const degrees = (Math.atan2(dx, north) * 180) / Math.PI
  return { angle: (degrees + 360) % 360, distance }
}

/**
 * A compact field dial for recording where a shot went.
 * Tapping the field places the shot; arrow keys rotate and resize it, and
 * Enter/Space commits. Skipping is always one tap away.
 */
export function ShotPicker({
  onPick,
  onSkip,
  busy = false,
}: {
  onPick: (angle: number, distance: number) => void
  onSkip: () => void
  busy?: boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [angle, setAngle] = useState(0)
  const [distance, setDistance] = useState(1)

  const preview = polarToXY(angle, distance, DIAL_RADIUS)

  function handleClick(event: MouseEvent<SVGSVGElement>): void {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    const scale = DIAL_SIZE / rect.width
    const x = (event.clientX - rect.left) * scale
    const y = (event.clientY - rect.top) * scale
    const placed = angleDistanceFromPoint(x, y)
    onPick(placed.angle, placed.distance)
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    let nextAngle = angle
    let nextDistance = distance
    if (event.key === 'ArrowLeft') nextAngle = (angle - 15 + 360) % 360
    else if (event.key === 'ArrowRight') nextAngle = (angle + 15) % 360
    else if (event.key === 'ArrowUp') nextDistance = Math.min(1, Math.round((distance + 0.1) * 10) / 10)
    else if (event.key === 'ArrowDown') nextDistance = Math.max(0, Math.round((distance - 0.1) * 10) / 10)
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPick(angle, distance)
      return
    } else {
      return
    }
    event.preventDefault()
    setAngle(nextAngle)
    setDistance(nextDistance)
  }

  return (
    <section className="card shot-picker" aria-label="Record shot placement">
      <h2>Where did it go?</h2>
      <p className="muted">Tap the field to place the shot. Arrow keys rotate and resize it.</p>
      <svg
        ref={svgRef}
        className="shot-picker-dial"
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="application"
        aria-label={`Shot direction dial, currently ${Math.round(angle)} degrees, distance ${Math.round(distance * 100)} percent`}
      >
        <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={DIAL_RADIUS} className="shot-picker-ring" />
        <line
          x1={DIAL_CENTER}
          y1={DIAL_CENTER - DIAL_RADIUS}
          x2={DIAL_CENTER}
          y2={DIAL_CENTER + DIAL_RADIUS}
          className="shot-picker-guide"
        />
        <line
          x1={DIAL_CENTER - DIAL_RADIUS}
          y1={DIAL_CENTER}
          x2={DIAL_CENTER + DIAL_RADIUS}
          y2={DIAL_CENTER}
          className="shot-picker-guide"
        />
        <line
          x1={DIAL_CENTER + preview.x}
          y1={DIAL_CENTER + preview.y}
          x2={DIAL_CENTER}
          y2={DIAL_CENTER}
          className="shot-picker-spoke"
        />
        <circle cx={DIAL_CENTER + preview.x} cy={DIAL_CENTER + preview.y} r={7} className="shot-picker-marker" />
      </svg>
      <button type="button" className="btn ghost wide" onClick={onSkip} disabled={busy}>
        Skip
      </button>
    </section>
  )
}
