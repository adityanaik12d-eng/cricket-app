/**
 * The matches created on this device. There are no accounts, so "Your matches"
 * is just a list of ids in localStorage — it never leaves the browser and it is
 * allowed to be lost (private mode, cleared storage).
 */
const KEY = 'cricket.myMatches'
const MAX = 50

export interface MatchStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function parse(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

/** Newest first. Never throws — a blocked or poisoned store reads as empty. */
export function myMatchIds(store?: MatchStore): string[] {
  try {
    const s = store ?? localStorage
    return parse(s.getItem(KEY)).slice(0, MAX)
  } catch {
    return []
  }
}

/** Called once when a match is created. Never throws — losing this list is survivable. */
export function rememberMatch(id: string, store?: MatchStore): void {
  try {
    const s = store ?? localStorage
    const next = [id, ...myMatchIds(s).filter((existing) => existing !== id)].slice(0, MAX)
    s.setItem(KEY, JSON.stringify(next))
  } catch {
    // No storage (private mode, quota): the match still exists, we just cannot list it.
  }
}