import { useEffect, useState } from 'react'
import { type Theme, THEME_LABEL, applyTheme, nextTheme, readStoredTheme, storeTheme } from './theme'

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'paper') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        <path d="M12 12a4 4 0 0 1 0 8" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    )
  }
  if (theme === 'floodlight') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l1.8 4.6L18 8.2l-4.2 1.6L12 14.4l-1.8-4.6L6 8.2l4.2-1.6L12 2z" />
        <path d="M19 13l.9 2.2 2.1.8-2.1.8L19 19l-.9-2.2-2.1-.8 2.1-.8.9-2.2z" />
        <path d="M5 13l.7 1.7 1.8.6-1.8.7L5 18l-.7-1.7-1.8-.7 1.8-.6L5 13z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Cycles the theme preference paper → floodlight → auto and reflects it on <html>.
 * The control itself is only an affordance; the appearance lives in index.css.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'auto' : readStoredTheme(),
  )

  useEffect(() => {
    applyTheme(theme)
    storeTheme(theme)
  }, [theme])

  const label = `Theme: ${THEME_LABEL[theme]}`
  return (
    <button
      type="button"
      className="btn ghost theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}