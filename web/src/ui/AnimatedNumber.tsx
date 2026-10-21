import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  /** The number to end on. Drawn instantly on first render, then counted to on change. */
  value: number
  /** Total time the count takes, in milliseconds. */
  duration?: number
  /** Optional class applied to the wrapping span. */
  className?: string
}

/**
 * Renders a number that counts up (or down) to `value` whenever it changes.
 * It is purely cosmetic: the destination is `value` itself, so the score is
 * never wrong even if the animation is interrupted.
 */
export function AnimatedNumber({ value, duration = 400, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return

    const diff = value - from
    const steps = Math.abs(diff)
    const stepTime = Math.max(Math.round(duration / steps), 16)
    let current = from

    const timer = window.setInterval(() => {
      current += diff > 0 ? 1 : -1
      setDisplay(current)
      if (current === value) window.clearInterval(timer)
    }, stepTime)

    return () => window.clearInterval(timer)
  }, [value, duration])

  return <span className={className}>{display}</span>
}
