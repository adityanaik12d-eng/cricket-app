import { useEffect, useRef, useMemo } from 'react'
import type { LiveScore, MatchEvent } from '@cricket-app/core'
import { effectiveEvents } from '@cricket-app/core'

interface Props {
  live: LiveScore
  events: MatchEvent[]
}

const PRESSURE_WINDOW = 12 // balls to consider for pressure calculation

export function PressureChart({ live, events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  const pressureData = useMemo(() => {
    if (!live) return { points: [] as number[], maxPressure: 1 }

    // Get scored events for current innings
    const scored = effectiveEvents(events).filter(
      (e) => e.type === 'BALL' &&
      e.over < live.over || (e.over === live.over && e.ball <= live.thisOver.length)
    )

    // Get last N balls
    const recent = scored.slice(-PRESSURE_WINDOW)

    if (recent.length === 0) return { points: [], maxPressure: 1 }

    // Calculate pressure for each ball
    // Pressure = (target run rate / current run rate) * wicket factor
    // Higher pressure when chasing and RRR > CRR or wickets falling
    const points = recent.map((ball, idx) => {
      let pressure = 0.3 // baseline calm

      if (live.target != null && live.target > 0) {
        // Chasing - pressure based on required vs current run rate
        const rrr = live.requiredRunRate ?? live.runRate
        const crr = live.runRate
        const rateRatio = crr > 0 ? rrr / crr : 2
        pressure = Math.min(1, 0.3 + (rateRatio - 1) * 0.4)
      }

      // Wicket pressure spike
      if (ball.wicket) {
        pressure = Math.min(1, pressure + 0.3)
      }

      // Boundary reduces pressure
      if (ball.runs >= 4) {
        pressure = Math.max(0.1, pressure - 0.2)
      }

      // Dot ball increases pressure slightly
      if (ball.runs === 0 && ball.extras === 'NONE') {
        pressure = Math.min(1, pressure + 0.05)
      }

      return pressure
    })

    return { points, maxPressure: 1 }
  }, [live, events])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const centerY = height / 2

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      const { points, maxPressure } = pressureData
      if (points.length === 0) return

      const stepX = width / Math.max(points.length - 1, 1)

      // Draw calm/pressure zones
      const calmZone = centerY + height * 0.35
      const pressureZone = centerY - height * 0.35

      // Calm area (green)
      const calmGrad = ctx.createLinearGradient(0, centerY, 0, height)
      calmGrad.addColorStop(0, 'rgba(45, 125, 50, 0.1)')
      calmGrad.addColorStop(1, 'rgba(45, 125, 50, 0.03)')
      ctx.fillStyle = calmGrad
      ctx.fillRect(0, centerY, width, height / 2)

      // Pressure area (red)
      const pressureGrad = ctx.createLinearGradient(0, 0, 0, centerY)
      pressureGrad.addColorStop(0, 'rgba(184, 46, 46, 0.03)')
      pressureGrad.addColorStop(1, 'rgba(184, 46, 46, 0.1)')
      ctx.fillStyle = pressureGrad
      ctx.fillRect(0, 0, width, centerY)

      // Center line
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw pressure line
      ctx.beginPath()
      points.forEach((p, i) => {
        const x = i * stepX
        // Invert: high pressure = lower Y (top)
        const y = centerY + (0.5 - p) * height * 0.7
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      // Gradient stroke
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      grad.addColorStop(0, '#b82e2e')
      grad.addColorStop(0.5, '#c47600')
      grad.addColorStop(1, '#2d7d32')
      ctx.strokeStyle = grad
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Draw points
      points.forEach((p, i) => {
        const x = i * stepX
        const y = centerY + (0.5 - p) * height * 0.7

        // Point color based on pressure
        let color = '#2d7d32' // calm green
        if (p > 0.7) color = '#b82e2e'
        else if (p > 0.4) color = '#c47600'

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()

        // White center
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      })

      // Current ball indicator (latest point)
      if (points.length > 0) {
        const lastIdx = points.length - 1
        const x = lastIdx * stepX
        const y = centerY + (0.5 - points[lastIdx]) * height * 0.7

        ctx.strokeStyle = '#b82e2e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, 10, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    draw()
  }, [pressureData])

  return (
    <canvas
      ref={canvasRef}
      className="tide-canvas"
      width={400}
      height={60}
      aria-hidden="true"
      role="img"
      aria-label={`Match pressure: ${pressureData.points.length > 0 ?
        pressureData.points[pressureData.points.length - 1] > 0.7 ? 'High pressure' :
        pressureData.points[pressureData.points.length - 1] > 0.4 ? 'Moderate pressure' : 'Calm' : 'No data'}`}
    />
  )
}