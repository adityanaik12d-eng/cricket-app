import { api } from './api'
import { getSupabase } from './supabase'
import {
  createScorerToken,
  hashScorerToken,
  isScorerMatch,
  legacyMatchIds,
  readScorerToken,
  storeScorerToken,
} from './ownership'
import type { TokenStore } from './ownership'

/**
 * Who may score a match.
 *
 * The browser that created a match holds a secret token for it; the database
 * stores only the hash of that token and refuses any write that does not
 * carry it. This module decides what the UI is allowed to show.
 */
export interface ScorerStatus {
  /** True when this browser may score the match. */
  canScore: boolean
  /**
   * - `owned` this browser claimed the match.
   * - `legacy` the match was created here before tokens existed.
   * - `other-device` somebody else owns it.
   * - `watcher` this browser never owned it.
   */
  reason: 'owned' | 'legacy' | 'other-device' | 'watcher'
}

export interface ScorerControlApi {
  claimScoring(matchId: string, token: string): Promise<boolean>
  readScorerHash(matchId: string): Promise<string | null>
  readMatchOwner(matchId: string): Promise<string | null>
}

export interface ScorerControlDeps {
  api?: ScorerControlApi
  store?: TokenStore
}

const defaultApi: ScorerControlApi = {
  claimScoring: (matchId, token) => api.claimScoring(matchId, token),
  readScorerHash: (matchId) => api.readScorerHash(matchId),
  readMatchOwner: (matchId) => api.readMatchOwner(matchId),
}

/**
 * Claims scoring control of a match for this browser: mints a token when
 * there is none, keeps it locally and pushes its hash to the database.
 *
 * The database push is best effort — it only works once the schema change has
 * been applied — so this never throws and never blocks the caller.
 */
export async function claimScoringControl(
  matchId: string,
  deps: ScorerControlDeps = {},
): Promise<string> {
  return (await claimInternal(matchId, deps)).token
}

async function claimInternal(
  matchId: string,
  deps: ScorerControlDeps = {},
): Promise<{ token: string; claimed: boolean }> {
  const store = deps.store
  const token = readScorerToken(matchId, store) ?? createScorerToken()
  storeScorerToken(matchId, token, store)
  let claimed = false
  try {
    claimed = await (deps.api ?? defaultApi).claimScoring(matchId, token)
  } catch {
    // The database is not enforcing scoring rights yet, or it is unreachable.
  }
  return { token, claimed }
}

/**
 * Works out whether this browser may score the match.
 *
 * The local token decides the fast path. The database has the last word: if
 * another device owns the match, this browser is only a watcher even though it
 * still holds a (now stale) token.
 */
export async function resolveScorerStatus(
  matchId: string,
  deps: ScorerControlDeps = {},
): Promise<ScorerStatus> {
  const store = deps.store
  const token = readScorerToken(matchId, store)
  const isLegacyOwner = legacyMatchIds(store).includes(matchId)
  const control = deps.api ?? defaultApi

  // Auth-based ownership: a signed-in user who owns the match can score from
  // any device where they are signed in, regardless of the device token.
  try {
    const { data } = await getSupabase().auth.getUser()
    const userId = data.user?.id
    if (userId) {
      const ownerId = await control.readMatchOwner(matchId)
      if (ownerId === userId) return { canScore: true, reason: 'owned' }
      if (ownerId) return { canScore: false, reason: 'other-device' }
    }
  } catch {
    // Auth not available (offline or not configured) — fall through to token model.
  }

  if (!token && !isLegacyOwner) return { canScore: false, reason: 'watcher' }

  let hash: string | null = null
  try {
    hash = await control.readScorerHash(matchId)
  } catch {
    return { canScore: true, reason: token ? 'owned' : 'legacy' }
  }

  if (token) {
    const mine = await hashScorerToken(token)
    if (hash === mine) return { canScore: true, reason: 'owned' }
  }

  if (hash === null) {
    // Nobody has claimed the match yet — claim it for this browser.
    const { claimed } = await claimInternal(matchId, deps)
    return { canScore: true, reason: claimed ? 'owned' : 'legacy' }
  }

  return { canScore: false, reason: 'other-device' }
}

/** The fast, local-only answer: does this browser hold the match? */
export function ownsMatchLocally(matchId: string, store?: TokenStore): boolean {
  return isScorerMatch(matchId, store)
}
