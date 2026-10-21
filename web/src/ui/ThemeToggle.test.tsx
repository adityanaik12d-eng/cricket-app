import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('renders an accessible, labelled button', () => {
    const html = renderToStaticMarkup(<ThemeToggle />)
    expect(html).toContain('theme-toggle')
    expect(html).toContain('aria-label="Theme:')
    expect(html).toContain('type="button"')
  })

  it('defaults to the Auto (system) label without a DOM', () => {
    const html = renderToStaticMarkup(<ThemeToggle />)
    expect(html).toContain('Theme: Auto')
  })
})
