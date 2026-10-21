import { useEffect, useState } from 'react'
import { type Theme, THEME_LABEL, applyTheme, nextTheme, readStoredTheme, storeTheme } from './theme'

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    )
  }
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
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
 * Cycles the theme preference system → light → dark and reflects it on <html>.
 * The control itself is only an affordance; the appearance lives in index.css.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'system' : readStoredTheme(),
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
