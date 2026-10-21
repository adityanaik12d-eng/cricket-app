import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart } from './BarChart'

const bars = [
  {
    label: 'Over 1',
    segments: [
      { name: '4s', value: 1, tone: 'four' },
      { name: '1s', value: 1, tone: 'one' },
    ],
  },
  {
    label: 'Over 2',
    segments: [{ name: '6s', value: 1, tone: 'six' }],
  },
]

describe('BarChart', () => {
  it('describes the chart for assistive technology', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan chart: 2 overs" bars={bars} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Manhattan chart: 2 overs"')
  })

  it('renders a group per bar', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan" bars={bars} />)
    expect(html).toContain('chart-bar-group')
    expect(html).toContain('Over 1')
  })

  it('renders a segment per run type', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan" bars={bars} />)
    expect(html).toContain('chart-seg-four')
    expect(html).toContain('chart-seg-one')
    expect(html).toContain('chart-seg-six')
  })

  it('gives every segment a tooltip', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan" bars={bars} />)
    expect(html).toContain('<title>')
  })

  it('keeps the numbers in a table for screen readers', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan" bars={bars} />)
    expect(html).toContain('visually-hidden')
    expect(html).toContain('<table')
  })

  it('shows an empty state when there is nothing to plot', () => {
    const html = renderToStaticMarkup(<BarChart title="Manhattan" ariaLabel="Manhattan" bars={[]} />)
    expect(html).toContain('No data yet')
  })
})
