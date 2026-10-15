export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'match'; matchId: string; tab: 'scoring' | 'report' }
  | { name: 'signin' }
  | { name: 'profile' }

/**
 * Hash routing, so shared links work without any server rewrites.
 * `#/match/<id>` is frozen: it must always open the Scoring tab.
 */
export function parseHash(hash: string): Route {
  const match = /^#\/match\/([^/]+)(?:\/(report))?$/.exec(hash)
  if (match && match[1]) {
    return { name: 'match', matchId: match[1], tab: match[2] ? 'report' : 'scoring' }
  }
  if (hash === '#/new') return { name: 'setup' }
  if (hash === '#/signin') return { name: 'signin' }
  if (hash === '#/profile') return { name: 'profile' }
  return { name: 'home' }
}
