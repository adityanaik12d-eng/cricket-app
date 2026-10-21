import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LineChart } from './LineChart'

const series = [
  {
    id: 'innings-0',
    label: 'India',
    tone: 'a' as const,
    points: [
      { x: 1, y: 4, label: 'Over 1 — 4 runs' },
      { x: 2, y: 10, label: 'Over 2 — 10 runs' },
    ],
  },
]

describe('LineChart', () => {
  it('describes the chart for assistive technology', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm chart: 2 points" series={series} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Worm chart: 2 points"')
  })

  it('renders a line for each series', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm" series={series} />)
    expect(html).toContain('<polyline')
    expect(html).toContain('chart-line-a')
  })

  it('gives every point a tooltip', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm" series={series} />)
    expect(html).toContain('<title>Over 1 — 4 runs</title>')
    expect(html).toContain('<title>Over 2 — 10 runs</title>')
  })

  it('lists the series in a legend', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm" series={series} />)
    expect(html).toContain('chart-legend')
    expect(html).toContain('India')
  })

  it('keeps the numbers in a table for screen readers', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm" series={series} />)
    expect(html).toContain('visually-hidden')
    expect(html).toContain('<table')
    expect(html).toContain('<th scope="col">Over</th>')
  })

  it('shows an empty state when there is nothing to plot', () => {
    const html = renderToStaticMarkup(<LineChart title="Worm" ariaLabel="Worm" series={[]} />)
    expect(html).toContain('No data yet')
    expect(html).not.toContain('<polyline')
  })
})
