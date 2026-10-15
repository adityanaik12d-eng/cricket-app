import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeBoard, MatchCard } from './HomeScreen'
import type { MatchSummary } from './match'

const live: MatchSummary = {
  matchId: 'm1',
  teamAId: 'India',
  teamBId: 'Australia',
  label: 'India vs Australia',
  score: '148-3 (16.2 ov)',
  status: 'LIVE',
  statusText: 'LIVE',
  resultText: null,
}

const done: MatchSummary = {
  ...live,
  matchId: 'm2',
  label: 'Chennai vs Mumbai',
  score: '171-6 (20 ov)',
  status: 'DONE',
  statusText: 'Result',
  resultText: 'Chennai won by 12 runs',
}

const noop = (): void => {}

describe('MatchCard', () => {
  it('shows teams, score, status pill and result line', () => {
    const html = renderToStaticMarkup(<MatchCard summary={live} onOpen={noop} />)
    expect(html).toContain('India vs Australia')
    expect(html).toContain('148-3 (16.2 ov)')
    expect(html).toContain('LIVE')
  })

  it('shows the result line for a finished match', () => {
    const html = renderToStaticMarkup(<MatchCard summary={done} onOpen={noop} />)
    expect(html).toContain('Chennai won by 12 runs')
    expect(html).toContain('Result')
  })

  it('omits the score for a match that has not started (review focus 2)', () => {
    const upcoming: MatchSummary = { ...live, score: null, status: 'UPCOMING', statusText: 'Yet to start' }
    const html = renderToStaticMarkup(<MatchCard summary={upcoming} onOpen={noop} />)
    expect(html).toContain('Yet to start')
    expect(html).not.toContain('(0.0 ov)')
  })
})

describe('HomeBoard', () => {
  it('renders both sections with their cards', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[live]} mine={[done]} error={null} loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Live now')
    expect(html).toContain('Your matches')
    expect(html).toContain('India vs Australia')
    expect(html).toContain('Chennai vs Mumbai')
  })

  it('shows empty states instead of blank sections', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[]} mine={[]} error={null} loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Nothing being played right now.')
    expect(html).toContain('No matches on this device yet.')
  })

  it('shows the error and keeps Refresh usable (review focus 5)', () => {
    const html = renderToStaticMarkup(
      <HomeBoard liveNow={[]} mine={[]} error="Network unreachable" loading={false} onNew={noop} onRefresh={noop} onOpen={noop} />,
    )
    expect(html).toContain('Network unreachable')
    expect(html).toContain('Refresh')
    expect(html).not.toContain('disabled')
  })
})
