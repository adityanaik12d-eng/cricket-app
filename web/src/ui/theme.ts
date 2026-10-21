export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'cricket-app:theme'

/** Human-facing label for each theme preference. */
export const THEME_LABEL: Record<Theme, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
}

/** Pick the concrete light/dark scheme for a stored preference. */
export function resolveTheme(preference: Theme, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}

/** Cycle system → light → dark → system. */
export function nextTheme(current: Theme): Theme {
  if (current === 'system') return 'light'
  if (current === 'light') return 'dark'
  return 'system'
}

/** Read the persisted preference; defaults to `system` when unavailable. */
export function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system'
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* storage can be blocked (private mode) — fall through */
  }
  return 'system'
}

/** Persist the preference; a no-op when storage is unavailable. */
export function storeTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore quota / blocked storage */
  }
}

/** Reflect the preference on <html> so CSS can react. `system` clears the override. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** Apply the persisted theme at startup (before first paint when possible). */
export function initTheme(): void {
  applyTheme(readStoredTheme())
}
