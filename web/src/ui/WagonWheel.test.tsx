import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { withDefaults } from '@cricket-app/core'
import type { BallEvent, MatchConfig, MatchEvent } from '@cricket-app/core'
import { WagonWheel, wagonBallLabel, wagonShotLabel } from './WagonWheel'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
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

describe('wagonBallLabel', () => {
  it('labels the delivery one-based', () => {
    expect(wagonBallLabel({ seq: 1, over: 4, ball: 1, batterId: 'a1', runs: 0, extras: 'NONE', angle: 0, distance: 1, wicket: false })).toBe('4.2')
  })
})

describe('wagonShotLabel', () => {
  it('describes the batter, runs and angle', () => {
    const shot = { seq: 1, over: 4, ball: 1, batterId: 'a1', runs: 4, extras: 'NONE' as const, angle: 45, distance: 0.8, wicket: false }
    expect(wagonShotLabel(config, shot)).toBe('4.2, Kohli, 4 runs, 45 degrees')
  })

  it('uses the singular for a single run', () => {
    const shot = { seq: 1, over: 0, ball: 0, batterId: 'a1', runs: 1, extras: 'NONE' as const, angle: 90, distance: 0.5, wicket: false }
    expect(wagonShotLabel(config, shot)).toBe('0.1, Kohli, 1 run, 90 degrees')
  })
})

describe('WagonWheel', () => {
  it('shows an empty state when nothing has a placement', () => {
    const html = renderToStaticMarkup(<WagonWheel config={config} events={[ball({ runs: 4 })]} />)
    expect(html).toContain('No shot placement recorded yet')
    expect(html).not.toContain('wheel-svg')
  })

  it('renders one spoke per recorded shot', () => {
    const events: MatchEvent[] = [
      ball({ runs: 4, shotAngle: 45, shotDistance: 0.8 }),
      ball({ runs: 6, shotAngle: 120, shotDistance: 1 }),
    ]
    const html = renderToStaticMarkup(<WagonWheel config={config} events={events} />)
    expect(html).toContain('wheel-svg')
    expect(html).toContain('wheel-shot-four')
    expect(html).toContain('wheel-shot-six')
  })

  it('describes the wheel for assistive technology', () => {
    const events: MatchEvent[] = [
      ball({ runs: 4, shotAngle: 45 }),
      ball({ runs: 6, shotAngle: 120 }),
    ]
    const html = renderToStaticMarkup(<WagonWheel config={config} events={events} />)
    expect(html).toContain('aria-label="Wagon wheel: 2 shots, 10 runs, 1 fours, 1 sixes"')
    expect(html).toContain('role="img"')
  })

  it('offers batter and run filters', () => {
    const events: MatchEvent[] = [ball({ batterId: 'a1', runs: 4, shotAngle: 45 }), ball({ batterId: 'a2', runs: 1, shotAngle: 90 })]
    const html = renderToStaticMarkup(<WagonWheel config={config} events={events} />)
    expect(html).toContain('All batters')
    expect(html).toContain('Kohli')
    expect(html).toContain('Rohit')
    expect(html).toContain('aria-label="Filter by runs"')
    expect(html).toContain('aria-pressed="false"')
  })

  it('summarises the wheel in a legend', () => {
    const events: MatchEvent[] = [ball({ runs: 4, shotAngle: 45 })]
    const html = renderToStaticMarkup(<WagonWheel config={config} events={events} />)
    expect(html).toContain('wheel-legend')
    expect(html).toContain('1 shots')
    expect(html).toContain('1 fours')
  })
})
