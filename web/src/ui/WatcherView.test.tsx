import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WatcherView } from './WatcherView'
import type { CommentaryLine, LiveScore, MatchConfig } from '@cricket-app/core'

const config: MatchConfig = {
  matchId: 'm1',
  teamAId: 'india',
  teamBId: 'australia',
  oversPerInnings: 20,
  powerplayOvers: 6,
  lineups: { A: ['a1'], B: ['b1'] },
  playerRefs: {
    a1: { name: 'Rohit', verified: true },
    b1: { name: 'Mitchell', verified: true },
  },
} as unknown as MatchConfig

const live: LiveScore = {
  status: 'IN_PROGRESS',
  inningsIndex: 0,
  battingTeamId: 'india',
  bowlingTeamId: 'australia',
  runs: 78,
  wickets: 2,
  oversText: '12.4',
  oversDecimal: 12.4,
  runRate: 6.12,
  target: 151,
  requiredRunRate: 7.26,
  freeHit: false,
  declared: false,
  powerplay: false,
  ballsRemaining: 44,
  thisOver: [
    { label: '12.1', text: '1', wicket: false, runs: 1 },
    { label: '12.2', text: '4', wicket: false, runs: 4 },
    { label: '12.3', text: 'W', wicket: true, runs: 0 },
    { label: '12.4', text: '6', wicket: false, runs: 6 },
  ],
  striker: { playerId: 'a1', runs: 40, balls: 26 },
  nonStriker: { playerId: 'a2', runs: 12, balls: 9 },
  bowler: { playerId: 'b1', runs: 30, balls: 24, wickets: 1 },
} as unknown as LiveScore

const commentary: CommentaryLine[] = [
  { seq: 1, kind: 'BALL', over: '12.4', text: 'Mitchell to Rohit: SIX' },
  { seq: 2, kind: 'OVER', over: null, text: 'End of over 12: India 78/2' },
]

function render(): string {
  return renderToStaticMarkup(
    <WatcherView config={config} live={live} events={[]} commentary={commentary} />,
  )
}

describe('WatcherView', () => {
  it('shows the live score', () => {
    const html = render()
    expect(html).toContain('78-2')
    expect(html).toContain('12.4')
    expect(html).toContain('CRR 6.12')
  })

  it('shows the chase target', () => {
    const html = render()
    expect(html).toContain('Target 151')
    expect(html).toContain('RRR 7.26')
  })

  it('shows the players at the crease and the bowler', () => {
    const html = render()
    expect(html).toContain('Rohit')
    expect(html).toContain('40 (26)')
    expect(html).toContain('Mitchell')
  })

  it('shows the balls of the current over', () => {
    const html = render()
    expect(html).toContain('This over')
    expect(html).toContain('>6<')
    expect(html).toContain('aria-label="12.3: wicket"')
  })

  it('shows the commentary', () => {
    const html = render()
    expect(html).toContain('Commentary')
    expect(html).toContain('Mitchell to Rohit: SIX')
    expect(html).toContain('End of over 12')
  })

  it('never offers a way to score', () => {
    const html = render()
    expect(html).not.toContain('pad-btn')
    expect(html).not.toContain('Undo')
    expect(html).not.toContain('Record placement')
    expect(html).not.toContain('<button')
  })

  it('marks itself as a read-only view', () => {
    expect(render()).toContain('Watching')
  })
})
