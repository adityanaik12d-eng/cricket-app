import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LiveScore } from '@cricket-app/core'
import { StickyScore } from './StickyScore'

function live(patch: Partial<LiveScore> = {}): LiveScore {
  return {
    runs: 42,
    wickets: 3,
    oversText: '10.2',
    runRate: 4.06,
    requiredRunRate: null,
    target: null,
    ballsRemaining: 58,
    status: 'IN_PROGRESS',
    battingTeamId: 'A',
    ...patch,
  } as LiveScore
}

describe('StickyScore', () => {
  it('shows the score, overs and current run rate', () => {
    const html = renderToStaticMarkup(<StickyScore live={live()} visible />)
    expect(html).toContain('42')
    expect(html).toContain('3')
    expect(html).toContain('(10.2 ov)')
    expect(html).toContain('CRR 4.06')
  })

  it('adds the required rate and requirement while chasing', () => {
    const html = renderToStaticMarkup(
      <StickyScore live={live({ target: 120, requiredRunRate: 5.5 })} visible />,
    )
    expect(html).toContain('RRR 5.50')
    expect(html).toContain('A need 78 off 58')
  })

  it('omits the required rate when there is no chase', () => {
    const html = renderToStaticMarkup(<StickyScore live={live()} visible />)
    expect(html).not.toContain('RRR')
  })

  it('is hidden and inert until it becomes visible', () => {
    const html = renderToStaticMarkup(<StickyScore live={live()} visible={false} />)
    expect(html).toContain('sticky-score')
    expect(html).not.toContain('is-visible')
    expect(html).toContain('aria-hidden="true"')
  })

  it('is announced once visible', () => {
    const html = renderToStaticMarkup(<StickyScore live={live()} visible />)
    expect(html).toContain('is-visible')
    expect(html).toContain('aria-hidden="false"')
    expect(html).toContain('aria-label="Live score"')
  })
})
