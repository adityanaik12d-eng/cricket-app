import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { withDefaults } from '@cricket-app/core'
import type { BallEvent, MatchConfig } from '@cricket-app/core'
import { MatchCharts } from './MatchCharts'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'india',
  teamBId: 'australia',
  lineups: { A: ['a1', 'a2'], B: ['b1'] },
  playerRefs: { a1: { name: 'Kohli' }, a2: { name: 'Rohit' }, b1: { name: 'Bumrah' } },
})

let seq = 0
function ball(p: Partial<BallEvent> = {}): BallEvent {
  seq += 1
  return {
    id: `e${seq}`,
    matchId: 'm1',
    seq,
    ts: '2026-10-08T10:00:00.000Z',
    type: 'BALL',
    over: 0,
    ball: 0,
    runs: 0,
    extras: 'NONE',
    wicket: false,
    dismissal: null,
    dismissedPlayerId: null,
    batterId: 'a1',
    nonStrikerId: 'a2',
    bowlerId: 'b1',
    fieldingCaptainId: 'b1',
    ...p,
  }
}

describe('MatchCharts', () => {
  it('shows an empty state when nothing has been bowled', () => {
    const html = renderToStaticMarkup(<MatchCharts config={config} events={[]} />)
    expect(html).toContain('No deliveries yet')
    expect(html).not.toContain('chart-svg')
  })

  it('draws the three charts', () => {
    const html = renderToStaticMarkup(<MatchCharts config={config} events={[ball({ runs: 4 }), ball({ ball: 1, runs: 6 })]} />)
    expect(html).toContain('Worm')
    expect(html).toContain('Manhattan')
    expect(html).toContain('Run rate')
    expect(html).toContain('chart-svg')
  })

  it('summarises the innings totals', () => {
    const html = renderToStaticMarkup(<MatchCharts config={config} events={[ball({ runs: 4 }), ball({ ball: 1, runs: 6 })]} />)
    expect(html).toContain('india')
    expect(html).toContain('10')
    expect(html).toContain('Run rate')
  })

  it('lets the reader pick which innings the Manhattan chart shows', () => {
    const html = renderToStaticMarkup(
      <MatchCharts
        config={config}
        events={[ball({ over: 1, ball: 0, runs: 4 }), ball({ over: 0, ball: 0, batterId: 'b1', bowlerId: 'a1', runs: 6 })]}
      />,
    )
    expect(html).toContain('chart-innings-toggle')
    expect(html).toContain('Innings 1')
    expect(html).toContain('Innings 2')
  })
})
