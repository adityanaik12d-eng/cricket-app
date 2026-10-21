import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DIAL_CENTER, DIAL_RADIUS, ShotPicker, angleDistanceFromPoint } from './ShotPicker'

describe('angleDistanceFromPoint', () => {
  it('maps the centre to 0 degrees at zero distance', () => {
    const p = angleDistanceFromPoint(DIAL_CENTER, DIAL_CENTER)
    expect(p.angle).toBeCloseTo(0)
    expect(p.distance).toBeCloseTo(0)
  })

  it('maps straight up to 0 degrees at full distance', () => {
    const p = angleDistanceFromPoint(DIAL_CENTER, DIAL_CENTER - DIAL_RADIUS)
    expect(p.angle).toBeCloseTo(0)
    expect(p.distance).toBeCloseTo(1)
  })

  it('maps right to 90 degrees', () => {
    expect(angleDistanceFromPoint(DIAL_CENTER + DIAL_RADIUS, DIAL_CENTER).angle).toBeCloseTo(90)
  })

  it('maps left to 270 degrees', () => {
    expect(angleDistanceFromPoint(DIAL_CENTER - DIAL_RADIUS, DIAL_CENTER).angle).toBeCloseTo(270)
  })

  it('maps down to 180 degrees', () => {
    expect(angleDistanceFromPoint(DIAL_CENTER, DIAL_CENTER + DIAL_RADIUS).angle).toBeCloseTo(180)
  })

  it('clamps points outside the dial to full distance', () => {
    expect(angleDistanceFromPoint(DIAL_CENTER, DIAL_CENTER - DIAL_RADIUS * 2).distance).toBe(1)
  })
})

describe('ShotPicker', () => {
  it('renders a dial and a skip control', () => {
    const html = renderToStaticMarkup(<ShotPicker onPick={() => {}} onSkip={() => {}} />)
    expect(html).toContain('shot-picker')
    expect(html).toContain('Where did it go?')
    expect(html).toContain('Skip')
    expect(html).toContain('aria-label="Shot direction dial')
  })

  it('exposes the dial to the keyboard', () => {
    const html = renderToStaticMarkup(<ShotPicker onPick={() => {}} onSkip={() => {}} />)
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('role="application"')
  })

  it('always offers a way out', () => {
    const html = renderToStaticMarkup(<ShotPicker onPick={() => {}} onSkip={() => {}} busy />)
    expect(html).toContain('disabled')
  })
})
