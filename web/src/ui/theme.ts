/**
 * Living Scorebook Theme System
 * Three themes: Paper (day), Floodlight (night), Auto (system)
 */
export type Theme = 'paper' | 'floodlight' | 'auto';

const STORAGE_KEY = 'cricket-app:theme';

/** Human-facing label for each theme preference. */
export const THEME_LABEL: Record<Theme, string> = {
  paper: 'Paper (Day)',
  floodlight: 'Floodlight (Night)',
  auto: 'Auto (System)',
};

/** Pick the concrete theme for a stored preference. */
export function resolveTheme(preference: Theme, prefersDark: boolean): 'paper' | 'floodlight' {
  if (preference === 'paper') return 'paper';
  if (preference === 'floodlight') return 'floodlight';
  return prefersDark ? 'floodlight' : 'paper';
}

/** Cycle paper -> floodlight -> auto. */
export function nextTheme(current: Theme): Theme {
  if (current === 'paper') return 'floodlight';
  if (current === 'floodlight') return 'auto';
  return 'paper';
}

/** Read the persisted preference; defaults to `auto`. */
export function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'paper' || value === 'floodlight' || value === 'auto') return value;
  } catch {
    /* storage can be blocked (private mode) — fall through */
  }
  return 'auto';
}

/** Persist the preference; a no-op when storage is unavailable. */
export function storeTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / blocked storage */
  }
}

/** Reflect the preference on <html> so CSS can react. `auto` clears the override. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/** Apply the persisted theme at startup (before first paint when possible). */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}