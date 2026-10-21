import { useChartWidth, axisScale, compactNumber, withUnit } from './chart-utils'

export interface LineChartPoint {
  /** Position on the x axis — an over number for every chart in this app. */
  x: number
  y: number
  /** Text shown when the point is hovered or focused. */
  label: string
  /** Short label for the x axis; defaults to the x value. */
  tickLabel?: string
}

export type LineChartTone = 'a' | 'b' | 'req'

export interface LineChartSeries {
  id: string
  label: string
  tone?: LineChartTone
  points: LineChartPoint[]
}

export interface LineChartProps {
  title: string
  ariaLabel: string
  series: LineChartSeries[]
  height?: number
  /** Unit appended to the numbers in the table and the axis, e.g. "runs". */
  unit?: string
  /** Caption under the plot, e.g. "Over". */
  xLabel?: string
}

const PAD = { top: 16, right: 16, bottom: 32, left: 46 }

/**
 * A hand-drawn line chart. Every point carries a tooltip, and the numbers are
 * repeated in a table for screen readers — the picture is never the only way
 * to read the data.
 */
export function LineChart({ title, ariaLabel, series, height = 220, unit, xLabel }: LineChartProps) {
  const { ref, width } = useChartWidth()
  const plotted = series.filter((s) => s.points.length > 0)

  if (plotted.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart-caption">{title}</figcaption>
        <p className="muted chart-empty">No data yet</p>
      </figure>
    )
  }

  const points = plotted.flatMap((s) => s.points)
  const xValues = points.map((p) => p.x)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const { max: yMax, ticks } = axisScale(Math.max(...points.map((p) => p.y)))

  const plotWidth = Math.max(40, width - PAD.left - PAD.right)
  const plotHeight = Math.max(40, height - PAD.top - PAD.bottom)
  const xSpan = xMax - xMin || 1

  const sx = (x: number): number => PAD.left + ((x - xMin) / xSpan) * plotWidth
  const sy = (y: number): number => PAD.top + plotHeight - (y / yMax) * plotHeight

  const rows = [...new Set(xValues)].sort((a, b) => a - b)

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
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + plotWidth} y1={sy(tick)} y2={sy(tick)} />
              <text className="chart-axis-text" x={PAD.left - 8} y={sy(tick) + 4} textAnchor="end">
                {compactNumber(tick)}
              </text>
            </g>
          ))}
          <line className="chart-axis" x1={PAD.left} x2={PAD.left + plotWidth} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />

          {plotted.map((s) => {
            const tone = s.tone ?? 'a'
            return (
              <g key={s.id} className={`chart-series chart-series-${tone}`}>
                {s.points.length > 1 && (
                  <polyline
                    className={`chart-line chart-line-${tone}`}
                    fill="none"
                    points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
                  />
                )}
                {s.points.map((p) => (
                  <circle key={`${s.id}-${p.x}-${p.y}-${p.label}`} className={`chart-dot chart-dot-${tone}`} cx={sx(p.x)} cy={sy(p.y)} r={4}>
                    <title>{p.label}</title>
                  </circle>
                ))}
              </g>
            )
          })}

          {rows.map((x) => (
            <text key={x} className="chart-axis-text" x={sx(x)} y={PAD.top + plotHeight + 18} textAnchor="middle">
              {plotted[0]?.points.find((p) => p.x === x)?.tickLabel ?? String(x)}
            </text>
          ))}
        </svg>
      </div>

      <ul className="chart-legend">
        {plotted.map((s) => (
          <li key={s.id} className="chart-legend-item">
            <span className={`chart-swatch chart-swatch-${s.tone ?? 'a'}`} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>

      {xLabel && <p className="chart-axis-title">{xLabel}</p>}

      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Over</th>
            {plotted.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x}>
              <th scope="row">{x}</th>
              {plotted.map((s) => {
                const point = s.points.find((p) => p.x === x)
                return <td key={s.id}>{point ? withUnit(Math.round(point.y * 10) / 10, unit) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
