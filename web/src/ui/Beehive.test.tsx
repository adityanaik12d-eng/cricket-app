import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BallEvent } from '@cricket-app/core'
import { Beehive } from './Beehive'

const ball = (p: Partial<BallEvent> = {}): BallEvent => ({
  id: 'e1',
  matchId: 'm1',
  seq: 1,
  ts: '2026-10-08T10:00:00.000Z',
  type: 'BALL',
  over: 0,
  ball: 0,
  runs: 4,
  extras: 'NONE',
  wicket: false,
  dismissal: null,
  dismissedPlayerId: null,
  batterId: 'a1',
  nonStrikerId: 'a2',
  bowlerId: 'b1',
  fieldingCaptainId: 'b1',
  ...p,
})

describe('Beehive', () => {
  it('shows an empty state with a hint to record placement', () => {
    const html = renderToStaticMarkup(createElement(Beehive, { events: [] }))
    expect(html).toContain('Beehive')
    expect(html).toContain('Record placement')
  })

  it('renders an svg with role img and an accessible label', () => {
    const html = renderToStaticMarkup(createElement(Beehive, { events: [ball({ shotAngle: 0, shotDistance: 0.2, runs: 4 })] }))
    expect(html).toContain('<svg')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Beehive: 1 ball, 4 runs"')
  })

  it('draws one cell per bucket and includes a title tooltip', () => {
    const html = renderToStaticMarkup(createElement(Beehive, { events: [ball({ shotAngle: 0, shotDistance: 0.2, runs: 4 })] }))
    expect(html).toContain('<polygon')
    expect(html).toContain('1 four')
  })

  it('includes a visually hidden data table', () => {
    const html = renderToStaticMarkup(createElement(Beehive, { events: [ball({ shotAngle: 0, shotDistance: 0.2, runs: 4 })] }))
    expect(html).toContain('visually-hidden')
    expect(html).toContain('<table')
  })

  it('colours cells by tone', () => {
    const html = renderToStaticMarkup(createElement(Beehive, { events: [ball({ shotAngle: 0, shotDistance: 0.2, runs: 1 })] }))
    expect(html).toContain('beehive-cell beehive-tone-low')
  })
})
