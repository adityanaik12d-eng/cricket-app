export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'match'; matchId: string; tab: 'scoring' | 'report' | 'scorecard' | 'wheel' | 'charts' | 'settings' }
  | { name: 'signin' }
  | { name: 'signup' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'standings' }
  | { name: 'tournaments' }
  | { name: 'tournament'; tournamentId: string }
  | { name: 'dls' }
  | { name: 'admin' }

/**
 * Hash routing, so shared links work without any server rewrites.
 * `#/match/<id>` is frozen: it must always open the Scoring tab.
 */
export function parseHash(hash: string): Route {
  const match = /^#\/match\/([^/]+)(?:\/(scoring|report|scorecard|wheel|charts|settings))?$/.exec(hash)
  if (match && match[1]) {
    const tab = (match[2] as 'scoring' | 'report' | 'scorecard' | 'wheel' | 'charts' | 'settings') ?? 'scoring'
    return { name: 'match', matchId: match[1], tab }
  }
  const tournament = /^#\/tournament\/([^/]+)$/.exec(hash)
  if (tournament && tournament[1]) return { name: 'tournament', tournamentId: tournament[1] }
  if (hash === '#/new') return { name: 'setup' }
  if (hash === '#/signin') return { name: 'signin' }
  if (hash === '#/signup') return { name: 'signup' }
  if (hash === '#/profile') return { name: 'profile' }
  if (hash === '#/settings') return { name: 'settings' }
  if (hash === '#/standings') return { name: 'standings' }
  if (hash === '#/tournaments') return { name: 'tournaments' }
  if (hash === '#/dls') return { name: 'dls' }
  if (hash === '#/admin') return { name: 'admin' }
  return { name: 'home' }
}
