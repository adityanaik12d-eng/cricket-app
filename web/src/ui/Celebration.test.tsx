import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeliveryCelebration } from '@cricket-app/core'
import { Celebration, scheduleCelebrationDismiss } from './Celebration'

function celebration(over: Partial<DeliveryCelebration> = {}): DeliveryCelebration {
  return {
    kind: 'none',
    label: '',
    runs: 0,
    wickets: 0,
    milestone: null,
    tier: 'none',
    ...over,
  }
}

describe('Celebration', () => {
  it('renders nothing when the delivery earned no celebration', () => {
    const html = renderToStaticMarkup(<Celebration celebration={celebration()} onDone={() => {}} />)
    expect(html).toBe('')
  })

  it('announces the celebration politely', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'six', label: 'SIX!', runs: 6, tier: 'big' })} onDone={() => {}} />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('celebration-six')
    expect(html).toContain('SIX!')
  })

  it('shows a ripple for a boundary', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'boundary', label: 'FOUR!', runs: 4, tier: 'small' })} onDone={() => {}} />,
    )
    expect(html).toContain('celebration-boundary')
    expect(html).toContain('celebration-ripple')
    expect(html).toContain('celebration-tier-small')
  })

  it('shows a burst for a six', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'six', label: 'SIX!', runs: 6, tier: 'big' })} onDone={() => {}} />,
    )
    expect(html).toContain('celebration-burst')
  })

  it('shows stumps for a wicket', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'wicket', label: 'WICKET!', wickets: 1, tier: 'big' })} onDone={() => {}} />,
    )
    expect(html).toContain('celebration-stumps')
    expect(html).toContain('<svg')
    expect(html).toContain('WICKET!')
  })

  it('shows the milestone number for a milestone', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'milestone', label: '50 RUNS', runs: 2, milestone: 50, tier: 'big' })} onDone={() => {}} />,
    )
    expect(html).toContain('celebration-badge')
    expect(html).toContain('>50<')
    expect(html).toContain('50 RUNS')
  })

  it('marks a huge celebration', () => {
    const html = renderToStaticMarkup(
      <Celebration celebration={celebration({ kind: 'milestone', label: '100 RUNS', runs: 1, milestone: 100, tier: 'huge' })} onDone={() => {}} />,
    )
    expect(html).toContain('celebration-tier-huge')
  })
})

describe('scheduleCelebrationDismiss', () => {
  it('calls onDone after the duration', () => {
    let done = 0
    let scheduled = 0
    scheduleCelebrationDismiss(
      () => {
        done += 1
      },
      1800,
      (fn) => {
        scheduled += 1
        fn()
        return 1
      },
    )
    expect(done).toBe(1)
    expect(scheduled).toBe(1)
  })

  it('cancels the timer when the overlay unmounts', () => {
    let cleared = 0
    let done = 0
    const cancel = scheduleCelebrationDismiss(
      () => {
        done += 1
      },
      1800,
      () => 7,
      () => {
        cleared += 1
      },
    )
    cancel()
    expect(cleared).toBe(1)
    expect(done).toBe(0)
  })
})
