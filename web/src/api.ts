import { applyEvents, projectLiveScore } from '@cricket-app/core'
import type { CommentaryLine, LiveScore, MatchConfig, MatchEvent, MatchState } from '@cricket-app/core'
import { getSupabase } from './supabase'
import { MatchError, appendEvent, buildConfig, computeBundle, computeCommentary, summarizeRows, withoutLastEvent } from './match'
import type { MatchBundle, MatchSummary } from './match'
import { hashScorerToken, isScorerMatch, readScorerToken, sha256Hex } from './ownership'

export type { MatchBundle }

/**
 * The header the database policy reads the scorer token from. PostgREST
 * exposes every request header to SQL, so the policy can check it without
 * the token ever being stored in the readable part of the row.
 */
const SCORER_TOKEN_HEADER = 'x-scorer-token'

export class ApiRequestError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
  }
}

export interface CreateMatchBody {
  teamAId: string
  teamBId: string
  lineups: { A: string[]; B: string[] }
  playerRefs: Record<string, { name: string; mobile?: string; verified: boolean }>
  oversPerInnings: number
  powerplayOvers: number
}

export interface Player {
  id: string
  mobile: string
  name: string
  role: 'BATSMAN' | 'BOWLER' | 'KEEPER' | 'ALL_ROUNDER'
  batting_hand: 'RHB' | 'LHB'
  bowling_style: string | null
  location: string | null
  created_at: string
}

export interface CareerStats {
  matches: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number
  notOuts: number
  wickets: number
  oversBowled: string
  runsConceded: number
  bestBowling: string
  catches: number
  stumpings: number
  runOuts: number
  batting: { innings: number; outCount: number; average: number; strikeRate: number }
  bowling: { innings: number; economy: number; average: number }
  fielding: { dismissals: number }
}

export interface AuthResponse {
  token: string
  player: Player
}

const UNAVAILABLE = 'Sign-in and shared player profiles are not part of the online scorer yet.'

function toApiError(err: unknown, fallback: string): ApiRequestError {
  if (err instanceof ApiRequestError) return err
  if (err instanceof MatchError) return new ApiRequestError(err.message, err.code)
  return new ApiRequestError(err instanceof Error ? err.message : fallback, 'ERROR')
}

/**
 * The scorer token this browser holds for a match, if any. A watcher has
 * none, and a watcher must never be able to write to the match.
 */
function scorerTokenFor(matchId: string): string | null {
  try {
    return readScorerToken(matchId)
  } catch {
    return null
  }
}

/** Adds the scorer token to a write so the database can check it. */
function withScorerToken<T extends { setHeader: (name: string, value: string) => T }>(
  query: T,
  token: string | null,
): T {
  if (token) query.setHeader(SCORER_TOKEN_HEADER, token)
  return query
}

/**
 * Refuses a write from a browser that does not own the match. The database
 * policy is the real gate; this keeps the mistake out of the request and
 * gives the UI a clear message.
 */
function assertScorer(matchId: string): void {
  if (isScorerMatch(matchId)) return
  throw new ApiRequestError('This match is being scored on another device', 'NOT_SCORER')
}

/** Loads a match row and replays it. One row = the whole match (config + log). */
async function loadRow(matchId: string): Promise<{ config: MatchConfig; events: MatchEvent[] }> {
  const { data, error } = await getSupabase()
    .from('matches')
    .select('config, events')
    .eq('id', matchId)
    .maybeSingle()
  if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
  if (!data) throw new ApiRequestError(`Match ${matchId} was not found`, 'NOT_FOUND')
  const row = data as { config: MatchConfig; events: MatchEvent[] | null }
  return { config: row.config, events: row.events ?? [] }
}

/**
 * Maps a Supabase Auth user to the app's Player shape. The profile lives in
 * the user's metadata; fields the user has not set get sensible defaults.
 */
function userToPlayer(user: { id: string; email?: string | null; phone?: string | null; created_at: string; user_metadata?: Record<string, unknown> }): Player {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const email = (user.email ?? '').trim()
  return {
    id: user.id,
    mobile: email,
    name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : 'Player',
    role: meta.role === 'BATSMAN' || meta.role === 'BOWLER' || meta.role === 'KEEPER' || meta.role === 'ALL_ROUNDER' ? meta.role : 'BATSMAN',
    batting_hand: meta.batting_hand === 'LHB' ? 'LHB' : 'RHB',
    bowling_style: typeof meta.bowling_style === 'string' ? meta.bowling_style : null,
    location: typeof meta.location === 'string' ? meta.location : null,
    created_at: user.created_at,
  }
}

export const api = {
  async createMatch(
    cfg: CreateMatchBody,
    scorerToken?: string,
  ): Promise<{ matchId: string; state: MatchState; live: LiveScore }> {
    const matchId = crypto.randomUUID()
    const config = buildConfig(cfg, matchId)
    // The hash of the scorer token rides along in the match config, so the
    // database can check every write without a schema change.
    const hash = scorerToken ? sha256Hex(scorerToken) : ''
    // If the creator is signed in, record them as the owner so they can score
    // from any device where they are signed in.
    let ownerId: string | null = null
    try {
      const { data } = await getSupabase().auth.getUser()
      ownerId = data.user?.id ?? null
    } catch {
      ownerId = null
    }
    const configWithOwner = ownerId ? { ...config, ownerId } : config
    const { error } = await getSupabase()
      .from('matches')
      .insert({ id: matchId, config: hash ? { ...configWithOwner, scorerTokenHash: hash } : configWithOwner, events: [] })
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    const state = applyEvents(config, [])
    return { matchId, state, live: projectLiveScore(state) }
  },

  async readMatchOwner(matchId: string): Promise<string | null> {
    const { data, error } = await getSupabase()
      .from('matches')
      .select('config')
      .eq('id', matchId)
      .maybeSingle()
    if (error || !data) return null
    const config = data.config as { ownerId?: string } | null
    return config?.ownerId ?? null
  },

  async getMatch(matchId: string): Promise<MatchBundle> {
    const { config, events } = await loadRow(matchId)
    return computeBundle(matchId, config, events)
  },

  async postEvent(
    matchId: string,
    payload: unknown,
  ): Promise<{ seq: number; state: MatchState; live: LiveScore }> {
    assertScorer(matchId)
    const { config, events } = await loadRow(matchId)
    let appended: ReturnType<typeof appendEvent>
    try {
      appended = appendEvent({
        matchId,
        config,
        events,
        payload,
        uuid: crypto.randomUUID(),
        now: new Date().toISOString(),
      })
    } catch (err) {
      throw toApiError(err, 'Could not record the event')
    }
    const { error } = await withScorerToken(
      getSupabase()
        .from('matches')
        .update({ events: appended.events, updated_at: new Date().toISOString() })
        .eq('id', matchId),
      scorerTokenFor(matchId),
    )
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    return { seq: appended.event.seq, state: appended.state, live: appended.live }
  },

  /**
   * Attaches an optional shot placement to an already-recorded delivery.
   * The delivery log lives in a single JSON column, so this rewrites that
   * column the same way `undoLast` does — no schema change is required.
   */
  async patchEventShot(
    matchId: string,
    seq: number,
    shot: { shotAngle: number; shotDistance: number },
  ): Promise<{ state: MatchState; live: LiveScore }> {
    assertScorer(matchId)
    const { config, events } = await loadRow(matchId)
    const next = events.map((event) =>
      event.type === 'BALL' && event.seq === seq
        ? { ...event, shotAngle: shot.shotAngle, shotDistance: shot.shotDistance }
        : event,
    )
    const { error } = await withScorerToken(
      getSupabase()
        .from('matches')
        .update({ events: next, updated_at: new Date().toISOString() })
        .eq('id', matchId),
      scorerTokenFor(matchId),
    )
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    const state = applyEvents(config, next)
    return { state, live: projectLiveScore(state) }
  },

  async getCommentary(matchId: string): Promise<{ commentary: CommentaryLine[] }> {
    const { config, events } = await loadRow(matchId)
    return { commentary: computeCommentary(config, events) }
  },

  /**
   * Board data. With `ids`, fetches exactly those matches (finished ones
   * included); otherwise the most recently updated matches across the board.
   * Rows that no longer replay are dropped rather than failing the request.
   */
  async listMatches(opts: { limit?: number; ids?: string[] } = {}): Promise<MatchSummary[]> {
    const limit = opts.limit ?? 50
    const query = getSupabase().from('matches').select('id, config, events, updated_at')
    const shaped = opts.ids
      ? query.in('id', opts.ids)
      : query.order('updated_at', { ascending: false }).limit(limit)
    const { data, error } = await shaped
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    return summarizeRows((data ?? []) as { id: string; config: unknown; events: unknown }[])
  },

  /**
   * Undoes the most recent delivery by dropping the tail of the log and
   * re-saving it. Rejected when there is nothing left to undo (an empty log or
   * the toss alone), so the button cannot leave a match headless.
   */
  async undoLast(matchId: string): Promise<{ state: MatchState; live: LiveScore }> {
    assertScorer(matchId)
    const { config, events } = await loadRow(matchId)
    const rewound = withoutLastEvent(events)
    if (rewound.length === events.length) {
      throw new ApiRequestError('There is nothing to undo', 'NOTHING_TO_UNDO')
    }
    const { error } = await withScorerToken(
      getSupabase()
        .from('matches')
        .update({ events: rewound, updated_at: new Date().toISOString() })
        .eq('id', matchId),
      scorerTokenFor(matchId),
    )
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    const state = applyEvents(config, rewound)
    return { state, live: projectLiveScore(state) }
  },

  /**
   * Stores the hash of the scorer token in the match config.
   *
   * Best effort: it only matters once the row policy exists, and a failure
   * here must never stop a match from being created, scored or watched.
   */
  async claimScoring(matchId: string, token: string): Promise<boolean> {
    const hash = await hashScorerToken(token)
    if (!hash) return false
    try {
      const { config } = await loadRow(matchId)
      const { error } = await withScorerToken(
        getSupabase()
          .from('matches')
          .update({ config: { ...config, scorerTokenHash: hash } })
          .eq('id', matchId),
        token,
      )
      return !error
    } catch {
      return false
    }
  },

  /**
   * The stored token hash of a match, or null when the match has never been
   * claimed. The hash lives in the match config, so reading it never fails.
   */
  async readScorerHash(matchId: string): Promise<string | null> {
    try {
      const { data, error } = await getSupabase()
        .from('matches')
        .select('config')
        .eq('id', matchId)
        .maybeSingle()
      if (error) return null
      const config = (data as { config?: { scorerTokenHash?: string } } | null)?.config
      return config?.scorerTokenHash ?? null
    } catch {
      return null
    }
  },

  // --- Shared player directory / accounts (server-backed) are deferred. The
  // online build keeps the setup flow working with local, in-memory players. ---

  async searchPlayers(_q: string): Promise<{ players: Player[] }> {
    return { players: [] }
  },

  async createPlayer(mobile: string, name: string): Promise<{ player: Player }> {
    return {
      player: {
        id: `player-${crypto.randomUUID()}`,
        mobile,
        name,
        role: 'BATSMAN',
        batting_hand: 'RHB',
        bowling_style: null,
        location: null,
        created_at: new Date().toISOString(),
      },
    }
  },

  async requestOtp(email: string): Promise<{ ok: true; devOtp?: string }> {
    const { error } = await getSupabase().auth.signInWithOtp({ email })
    if (error) throw new ApiRequestError(error.message, 'AUTH_ERROR')
    return { ok: true }
  },

  async verifyOtp(email: string, otp: string): Promise<AuthResponse> {
    const { data, error } = await getSupabase().auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (error || !data.session || !data.user) {
      throw new ApiRequestError(error?.message ?? 'Verification failed', 'OTP_MISMATCH')
    }
    const player = userToPlayer(data.user)
    return { token: data.session.access_token, player }
  },

  async register(email: string, otp: string, name: string): Promise<AuthResponse> {
    const { data, error } = await getSupabase().auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (error || !data.session || !data.user) {
      throw new ApiRequestError(error?.message ?? 'Verification failed', 'OTP_MISMATCH')
    }
    const { data: updated, error: updateError } = await getSupabase().auth.updateUser({
      data: { name: name.trim() || 'Player' },
    })
    if (updateError) throw new ApiRequestError(updateError.message, 'AUTH_ERROR')
    const player = userToPlayer(updated?.user ?? data.user)
    return { token: data.session.access_token, player }
  },

  async getMe(): Promise<{ player: Player }> {
    const { data, error } = await getSupabase().auth.getUser()
    if (error || !data.user) {
      throw new ApiRequestError('Not signed in', 'UNAUTHENTICATED')
    }
    return { player: userToPlayer(data.user) }
  },

  async patchMe(patch: Record<string, unknown>): Promise<{ player: Player }> {
    const { data, error } = await getSupabase().auth.updateUser({ data: patch })
    if (error || !data.user) {
      throw new ApiRequestError(error?.message ?? 'Update failed', 'AUTH_ERROR')
    }
    return { player: userToPlayer(data.user) }
  },

  async getPlayerStats(_id: string): Promise<CareerStats> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },
}
