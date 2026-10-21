import { useChartWidth, axisScale, compactNumber, withUnit } from './chart-utils'

export interface BarChartSegment {
  name: string
  value: number
  tone: string
}

export interface BarChartBar {
  label: string
  segments: BarChartSegment[]
}

export interface BarChartProps {
  title: string
  ariaLabel: string
  bars: BarChartBar[]
  height?: number
  unit?: string
}

const PAD = { top: 16, right: 16, bottom: 32, left: 46 }

interface PlacedSegment {
  segment: BarChartSegment
  y: number
  height: number
}

/** Stacks a bar's segments from the baseline upwards. */
function stackBar(bar: BarChartBar, toY: (value: number) => number): PlacedSegment[] {
  const placed: PlacedSegment[] = []
  let running = 0
  for (const segment of bar.segments) {
    if (segment.value <= 0) continue
    const top = toY(running + segment.value)
    const bottom = toY(running)
    placed.push({ segment, y: top, height: Math.max(0, bottom - top) })
    running += segment.value
  }
  return placed
}

/**
 * A hand-drawn stacked bar chart — one bar per over, split by the runs scored
 * in it. Every segment carries a tooltip and the figures are repeated in a
 * table for screen readers.
 */
export function BarChart({ title, ariaLabel, bars, height = 220, unit }: BarChartProps) {
  const { ref, width } = useChartWidth()

  if (bars.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart-caption">{title}</figcaption>
        <p className="muted chart-empty">No data yet</p>
      </figure>
    )
  }

  const totals = bars.map((bar) => bar.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0))
  const { max: yMax, ticks } = axisScale(Math.max(...totals))

  const plotWidth = Math.max(40, width - PAD.left - PAD.right)
  const plotHeight = Math.max(40, height - PAD.top - PAD.bottom)
  const slot = plotWidth / bars.length
  const barWidth = Math.max(4, Math.min(46, slot * 0.62))

  const toY = (value: number): number => PAD.top + plotHeight - (value / yMax) * plotHeight

  const legend = [...new Map(bars.flatMap((bar) => bar.segments).map((s) => [s.tone, s])).entries()]

  return (
    <figure className="chart">
      <figcaption className="chart-caption">{title}</figcaption>

      <div className="chart-plot">
        <svg
          ref={ref}
          className="chart-svg"
          role="img"
          aria-label={ariaLabel}
          height={height}
          viewBox={`0 0 ${Math.max(width, 1)} ${height}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + plotWidth} y1={toY(tick)} y2={toY(tick)} />
              <text className="chart-axis-text" x={PAD.left - 8} y={toY(tick) + 4} textAnchor="end">
                {compactNumber(tick)}
              </text>
            </g>
          ))}
          <line className="chart-axis" x1={PAD.left} x2={PAD.left + plotWidth} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />

          {bars.map((bar, index) => {
            const x = PAD.left + slot * index + (slot - barWidth) / 2
            return (
              <g key={bar.label} className="chart-bar-group">
                {stackBar(bar, toY).map((placed) => (
                  <rect
                    key={placed.segment.tone}
                    className={`chart-seg chart-seg-${placed.segment.tone}`}
                    x={x}
                    y={placed.y}
                    width={barWidth}
                    height={placed.height}
                  >
                    <title>{`${bar.label} — ${placed.segment.name}: ${withUnit(placed.segment.value, unit)}`}</title>
                  </rect>
                ))}
                <text className="chart-axis-text" x={x + barWidth / 2} y={PAD.top + plotHeight + 18} textAnchor="middle">
                  {bar.label.replace(/^Over\s+/, 'O')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <ul className="chart-legend">
        {legend.map(([tone, segment]) => (
          <li key={tone} className="chart-legend-item">
            <span className={`chart-swatch chart-swatch-${tone}`} aria-hidden="true" />
            {segment.name}
          </li>
        ))}
      </ul>

      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Over</th>
            {legend.map(([tone, segment]) => (
              <th key={tone} scope="col">
                {segment.name}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label}>
              <th scope="row">{bar.label}</th>
              {legend.map(([tone]) => {
                const segment = bar.segments.find((s) => s.tone === tone)
                return <td key={tone}>{segment ? withUnit(segment.value, unit) : withUnit(0, unit)}</td>
              })}
              <td>{withUnit(bar.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0), unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
