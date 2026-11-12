import { useMemo, useState } from 'react'
import { projectInningsTimeline, projectManhattan, projectRunRate, projectWorm, summariseInnings } from '@cricket-app/core'
import type { MatchConfig, MatchEvent } from '@cricket-app/core'
import { BarChart, type BarChartSegment } from './BarChart'
import { LineChart, type LineChartTone } from './LineChart'
import { plural, withUnit } from './chart-utils'

/** The runs scored in one over, split by the shot that made them. */
function manhattanSegments(runs: number, boundaries: { ones: number; twos: number; threes: number; fours: number; sixes: number }): BarChartSegment[] {
  const boundaryRuns = boundaries.ones + boundaries.twos * 2 + boundaries.threes * 3 + boundaries.fours * 4 + boundaries.sixes * 6
  const segments: BarChartSegment[] = []
  if (boundaries.ones > 0) segments.push({ name: 'Singles', value: boundaries.ones, tone: 'one' })
  if (boundaries.twos > 0) segments.push({ name: 'Twos', value: boundaries.twos * 2, tone: 'two' })
  if (boundaries.threes > 0) segments.push({ name: 'Threes', value: boundaries.threes * 3, tone: 'three' })
  if (boundaries.fours > 0) segments.push({ name: 'Fours', value: boundaries.fours * 4, tone: 'four' })
  if (boundaries.sixes > 0) segments.push({ name: 'Sixes', value: boundaries.sixes * 6, tone: 'six' })
  const other = Math.max(0, runs - boundaryRuns)
  if (other > 0) segments.push({ name: 'Other', value: other, tone: 'other' })
  return segments
}

/**
 * The three charts of the match: the worm (runs after every over), the
 * Manhattan chart (how each over was scored) and the run rate compared with
 * the rate needed to win.
 */
export function MatchCharts({ config, events }: { config: MatchConfig; events: MatchEvent[] }) {
  const data = useMemo(() => {
    const charts = projectInningsTimeline(config, events)
    return {
      charts,
      worm: projectWorm(charts),
      manhattan: projectManhattan(charts),
      runRate: projectRunRate(config, charts),
    }
  }, [config, events])

  const [selected, setSelected] = useState(0)

  if (data.charts.length === 0) {
    return (
      <section className="card charts" aria-label="Match charts">
        <h2>Charts</h2>
        <p className="muted chart-empty">No deliveries yet</p>
      </section>
    )
  }

  const teamLabel = (index: number): string => data.charts[index]?.battingTeamId ?? `Innings ${index + 1}`
  const toneFor = (index: number): LineChartTone => (index === 0 ? 'a' : 'b')

  const wormSeries = data.worm.map((series, index) => ({
    id: `worm-${series.innings}`,
    label: teamLabel(index),
    tone: toneFor(index),
    points: series.points.map((point) => ({
      x: point.overNumber,
      y: point.runs,
      label: `${point.label} — ${withUnit(point.runs, 'runs')}`,
      tickLabel: `O${point.overNumber}`,
    })),
  }))

  const requiredPoints = data.runRate
    .filter((series) => series.innings > 0)
    .flatMap((series) =>
      series.points
        .filter((point) => point.requiredRate != null)
        .map((point) => ({
          x: point.overNumber,
          y: point.requiredRate as number,
          label: `${point.label} — need ${(point.requiredRate as number).toFixed(2)} per over`,
          tickLabel: `O${point.overNumber}`,
        })),
    )

  const runRateSeries = [
    ...data.runRate.map((series, index) => ({
      id: `rr-${series.innings}`,
      label: teamLabel(index),
      tone: toneFor(index),
      points: series.points.map((point) => ({
        x: point.overNumber,
        y: point.runRate,
        label: `${point.label} — ${point.runRate.toFixed(2)} per over`,
        tickLabel: `O${point.overNumber}`,
      })),
    })),
    ...(requiredPoints.length > 0
      ? [{ id: 'required', label: 'Required rate', tone: 'req' as LineChartTone, points: requiredPoints }]
      : []),
  ]

  const manhattan = data.manhattan[selected]

  return (
    <section className="card charts" aria-label="Match charts">
      <header className="charts-header">
        <h2>Charts</h2>
        <div className="charts-controls">
          <div className="chart-innings-toggle" role="group" aria-label="Choose the innings for Manhattan chart">
            {data.charts.map((chart, index) => (
              <button
                key={chart.innings}
                type="button"
                className={index === selected ? 'chip active' : 'chip'}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                Innings {index + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="chart-summary-grid">
        {data.charts.map((chart, index) => {
          const summary = summariseInnings(chart)
          return (
            <div key={chart.innings} className="chart-summary">
              <span className="chart-summary-team">{teamLabel(index)}</span>
              <strong className="chart-summary-score">
                {chart.runs}-{chart.wickets}
              </strong>
              <span className="muted">{chart.oversText} overs</span>
              <span className="muted">Run rate {chart.runRate.toFixed(2)}</span>
              <span className="muted">Strike rate {summary.strikeRate.toFixed(2)}</span>
              <span className="muted">
                {plural(summary.boundaries.fours, 'four')} · {plural(summary.boundaries.sixes, 'six')}
              </span>
            </div>
          )
        })}
      </div>

      <div className="charts-grid">
        <LineChart
          title="Worm"
          ariaLabel={`Worm chart: runs after every over for ${data.charts.length} innings`}
          series={wormSeries}
          unit="runs"
          xLabel="Over"
        />

        <BarChart
          title="Manhattan"
          ariaLabel={`Manhattan chart: runs per over for innings ${selected + 1}`}
          bars={(manhattan?.bars ?? []).map((bar) => ({
            label: bar.label,
            segments: manhattanSegments(bar.runs, bar.boundaries),
          }))}
          unit="runs"
        />

        <LineChart
          title="Run rate"
          ariaLabel={`Run rate chart: runs per over for ${data.charts.length} innings`}
          series={runRateSeries}
          unit="per over"
          xLabel="Over"
        />
      </div>
    </section>
  )
}
