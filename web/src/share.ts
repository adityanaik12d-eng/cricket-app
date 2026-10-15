/**
 * The shareable link for a match. The app uses hash routing, so the match is
 * identified after the `#` — which means the link works on any static host
 * without server rewrites.
 */
export function matchShareUrl(matchId: string, origin: string): string {
  const base = origin.replace(/\/+$/, '')
  return `${base}/#/match/${encodeURIComponent(matchId)}`
}
