import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { extrasForGroup } from './scoring'
import { ExtrasSheet } from './ExtrasSheet'

describe('extrasForGroup', () => {
  it('lists the wide variants, including a plain wide', () => {
    expect(extrasForGroup('WIDE').options.map((o) => o.label)).toEqual([
      'WD+0',
      'WD+1',
      'WD+2',
      'WD+3',
      'WD+4',
    ])
  })

  it('lists the no-ball variants, including the six', () => {
    expect(extrasForGroup('NO_BALL').options.map((o) => o.label)).toEqual([
      'NB+0',
      'NB+1',
      'NB+2',
      'NB+3',
      'NB+4',
      'NB+6',
    ])
  })

  it('lists the bye and leg-bye variants, which always carry at least one run', () => {
    expect(extrasForGroup('BYE').options.map((o) => o.label)).toEqual(['B+1', 'B+2', 'B+3', 'B+4'])
    expect(extrasForGroup('LEG_BYE').options.map((o) => o.label)).toEqual([
      'LB+1',
      'LB+2',
      'LB+3',
      'LB+4',
    ])
  })

  it('carries the group kind and run count on every option', () => {
    expect(extrasForGroup('WIDE').kind).toBe('WIDE')
    expect(extrasForGroup('WIDE').options.every((o) => o.kind === 'WIDE')).toBe(true)
    expect(extrasForGroup('NO_BALL').options.map((o) => o.runs)).toEqual([0, 1, 2, 3, 4, 6])
  })

  it('labels each group the way the pad button should read', () => {
    expect(extrasForGroup('WIDE').label).toBe('Wide')
    expect(extrasForGroup('NO_BALL').label).toBe('No ball')
    expect(extrasForGroup('BYE').label).toBe('Bye')
    expect(extrasForGroup('LEG_BYE').label).toBe('Leg bye')
  })
})

describe('ExtrasSheet', () => {
  const noop = (): void => {}

  it('renders a modal dialog with the group name and only that group\u2019s options', () => {
    const html = renderToStaticMarkup(
      createElement(ExtrasSheet, {
        label: 'No ball',
        options: extrasForGroup('NO_BALL').options,
        onPick: noop,
        onClose: noop,
      }),
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('No ball')
    for (const label of ['NB+0', 'NB+1', 'NB+2', 'NB+3', 'NB+4', 'NB+6']) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain('WD+')
  })

  it('shows a rejected delivery\u2019s message inside the sheet', () => {
    const html = renderToStaticMarkup(
      createElement(ExtrasSheet, {
        label: 'Wide',
        options: extrasForGroup('WIDE').options,
        error: 'over complete',
        onPick: noop,
        onClose: noop,
      }),
    )
    expect(html).toContain('over complete')
  })

  it('omits any error line when there is nothing wrong', () => {
    const html = renderToStaticMarkup(
      createElement(ExtrasSheet, {
        label: 'Wide',
        options: extrasForGroup('WIDE').options,
        onPick: noop,
        onClose: noop,
      }),
    )
    expect(html).not.toContain('error')
  })

  it('disables every option while a delivery is being recorded', () => {
    const html = renderToStaticMarkup(
      createElement(ExtrasSheet, {
        label: 'Bye',
        options: extrasForGroup('BYE').options,
        busy: true,
        onPick: noop,
        onClose: noop,
      }),
    )
    expect(html.match(/disabled/g)?.length).toBe(4)
  })
})
