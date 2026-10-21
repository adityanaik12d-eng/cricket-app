import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { withDefaults } from '@cricket-app/core'
import type { BallEvent, MatchConfig, TimelineBall } from '@cricket-app/core'
import { OverTimeline, chipClass, describeBall } from './OverTimeline'

const config: MatchConfig = withDefaults({
  matchId: 'm1',
  teamAId: 'A',
  teamBId: 'B',
  lineups: { A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] },
  playerRefs: { a1: { name: 'Kohli' }, a2: { name: 'Rohit' }, b1: { name: 'Bumrah' }, b2: { name: 'Shaheen' } },
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

function tl(p: Partial<TimelineBall> = {}): TimelineBall {
  return {
    seq: 1,
    over: 0,
    ball: 0,
    label: '0.1',
    text: '0',
    runs: 0,
    wicket: false,
    extras: 'NONE',
    dismissal: null,
    batterId: 'a1',
    bowlerId: 'b1',
    ...p,
  }
}

describe('OverTimeline', () => {
  it('renders nothing before the first delivery', () => {
    expect(renderToStaticMarkup(<OverTimeline config={config} events={[]} innings={0} />)).toBe('')
  })

  it('renders each over with its deliveries', () => {
    const html = renderToStaticMarkup(
      <OverTimeline
        config={config}
        events={[ball({ over: 0, ball: 0 }), ball({ over: 0, ball: 1, runs: 4 })]}
        innings={0}
      />,
    )
    expect(html).toContain('Over timeline')
    expect(html).toContain('Over 1')
    expect(html).toContain('>4<')
    expect(html).toContain('>0<')
  })

  it('counts the overs in the header', () => {
    const html = renderToStaticMarkup(
      <OverTimeline config={config} events={[ball({ over: 0, ball: 0 }), ball({ over: 1, ball: 0 })]} innings={0} />,
    )
    expect(html).toContain('2 overs')
  })

  it('animates only the newest delivery', () => {
    const html = renderToStaticMarkup(
      <OverTimeline config={config} events={[ball({ over: 0, ball: 0 }), ball({ over: 0, ball: 1, runs: 4 })]} innings={0} />,
    )
    expect((html.match(/ball-in/g) ?? []).length).toBe(1)
  })

  it('shows only the requested innings', () => {
    const events = [ball({ over: 19, ball: 0 }), ball({ over: 0, ball: 0, batterId: 'b1', bowlerId: 'a1' })]
    const first = renderToStaticMarkup(<OverTimeline config={config} events={events} innings={0} />)
    expect(first).toContain('Over 20')
    expect(first).not.toContain('>Over 1<')
  })
})

describe('chipClass', () => {
  it('colours by outcome', () => {
    expect(chipClass(tl({ runs: 4 }))).toBe('chip accent')
    expect(chipClass(tl({ runs: 6 }))).toBe('chip accent')
    expect(chipClass(tl({ runs: 0 }))).toBe('chip dot')
    expect(chipClass(tl({ runs: 1 }))).toBe('chip')
    expect(chipClass(tl({ extras: 'WIDE' }))).toBe('chip warn')
    expect(chipClass(tl({ wicket: true, dismissal: 'BOWLED' }))).toBe('chip danger')
  })
})

describe('describeBall', () => {
  it('describes a boundary', () => {
    expect(describeBall(config, tl({ runs: 4 }))).toBe('0.1 · Bumrah to Kohli · FOUR')
  })
  it('describes a dot ball', () => {
    expect(describeBall(config, tl({ runs: 0 }))).toContain('dot ball')
  })
  it('describes a wicket with the dismissal', () => {
    expect(describeBall(config, tl({ wicket: true, dismissal: 'CAUGHT' }))).toContain('WICKET (caught)')
  })
  it('includes the wide penalty in the total', () => {
    expect(describeBall(config, tl({ extras: 'WIDE', runs: 1 }))).toContain('wide, 1 run total')
  })
})
