import { useEffect, useRef, useState } from 'react'

/**
 * The pixel width of a chart's SVG, kept in step with the card it sits in.
 * Server rendering falls back to a sensible default until the browser measures.
 */
export function useChartWidth(fallback = 640): { ref: React.RefObject<SVGSVGElement | null>; width: number } {
  const ref = useRef<SVGSVGElement | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = (): void => {
      const next = element.getBoundingClientRect().width
      if (next > 0) setWidth(next)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

/** A round vertical axis: a maximum and the gridlines that divide it. */
export interface AxisScale {
  max: number
  ticks: number[]
}

/**
 * Chooses a round step for the axis — the largest friendly step below the rough
 * one — so the gridlines land on numbers a reader recognises (0, 5, 10, 15)
 * rather than on fractions like 6.25.
 */
export function axisScale(maxValue: number, targetTicks = 3): AxisScale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 1, ticks: [0, 1] }

  const rough = maxValue / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  const candidates = [1, 2, 2.5, 5, 10]
  let nice = candidates[0] as number
  for (const candidate of candidates) {
    if (candidate <= normalised) nice = candidate
  }

  const step = nice * magnitude
  const max = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  for (let i = 0; i * step <= max + step / 2; i += 1) {
    ticks.push(Number((i * step).toFixed(4)))
  }
  return { max, ticks }
}

/** Trims a number to at most one decimal place, without trailing zeroes. */
export function compactNumber(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/** "1 run" / "8 runs" — the unit is singularised when there is only one. */
export function withUnit(value: number, unit: string | undefined): string {
  if (!unit) return String(value)
  const singular = unit.endsWith('s') && !unit.endsWith('ss') ? unit.slice(0, -1) : unit
  return `${value} ${value === 1 ? singular : unit}`
}

/** "1 four" / "2 fours" — counts read properly in a sentence. */
export function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : many}`
}
