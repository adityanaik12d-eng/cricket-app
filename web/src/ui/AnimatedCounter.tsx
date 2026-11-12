import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

/** Lightweight animated number (inspired by arceage-stats), no external deps. */
export function AnimatedCounter({ value, decimals = 0, prefix = '', suffix = '', duration = 900, className }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = useState(() => (prefix + (0).toFixed(decimals) + suffix))
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const target = Number.isFinite(value) ? value : 0
    const render = (v: number) => setDisplay(prefix + v.toFixed(decimals) + suffix)
    if (reduce) { render(target); return }

    let raf = 0
    const run = () => {
      if (started.current) return
      started.current = true
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        render(target * eased)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    if (typeof IntersectionObserver === 'undefined') { run(); return () => cancelAnimationFrame(raf) }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { run(); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, decimals, prefix, suffix, duration])

  return <span ref={ref} className={className}>{display}</span>
}
