import { applyEvents, projectLiveScore } from '@cricket-app/core'
import type { CommentaryLine, LiveScore, MatchConfig, MatchEvent, MatchState } from '@cricket-app/core'
import { getSupabase } from './supabase'
import { MatchError, appendEvent, buildConfig, computeBundle, computeCommentary, withoutLastEvent } from './match'
import type { MatchBundle } from './match'

export type { MatchBundle }

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

export const api = {
  async createMatch(
    cfg: CreateMatchBody,
  ): Promise<{ matchId: string; state: MatchState; live: LiveScore }> {
    const matchId = crypto.randomUUID()
    const config = buildConfig(cfg, matchId)
    const { error } = await getSupabase().from('matches').insert({ id: matchId, config, events: [] })
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    const state = applyEvents(config, [])
    return { matchId, state, live: projectLiveScore(state) }
  },

  async getMatch(matchId: string): Promise<MatchBundle> {
    const { config, events } = await loadRow(matchId)
    return computeBundle(matchId, config, events)
  },

  async postEvent(
    matchId: string,
    payload: unknown,
  ): Promise<{ seq: number; state: MatchState; live: LiveScore }> {
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
    const { error } = await getSupabase()
      .from('matches')
      .update({ events: appended.events, updated_at: new Date().toISOString() })
      .eq('id', matchId)
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    return { seq: appended.event.seq, state: appended.state, live: appended.live }
  },

  async getCommentary(matchId: string): Promise<{ commentary: CommentaryLine[] }> {
    const { config, events } = await loadRow(matchId)
    return { commentary: computeCommentary(config, events) }
  },

  /**
   * Undoes the most recent delivery by dropping the tail of the log and
   * re-saving it. Rejected when there is nothing left to undo (an empty log or
   * the toss alone), so the button cannot leave a match headless.
   */
  async undoLast(matchId: string): Promise<{ state: MatchState; live: LiveScore }> {
    const { config, events } = await loadRow(matchId)
    const rewound = withoutLastEvent(events)
    if (rewound.length === events.length) {
      throw new ApiRequestError('There is nothing to undo', 'NOTHING_TO_UNDO')
    }
    const { error } = await getSupabase()
      .from('matches')
      .update({ events: rewound, updated_at: new Date().toISOString() })
      .eq('id', matchId)
    if (error) throw new ApiRequestError(error.message, 'SUPABASE_ERROR')
    const state = applyEvents(config, rewound)
    return { state, live: projectLiveScore(state) }
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

  async requestOtp(_mobile: string): Promise<{ ok: true; devOtp?: string }> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },

  async verifyOtp(_mobile: string, _otp: string): Promise<AuthResponse> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },

  async register(_mobile: string, _otp: string, _name: string): Promise<AuthResponse> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },

  async getMe(): Promise<{ player: Player }> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },

  async patchMe(_patch: Record<string, unknown>): Promise<{ player: Player }> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },

  async getPlayerStats(_id: string): Promise<CareerStats> {
    throw new ApiRequestError(UNAVAILABLE, 'UNAVAILABLE')
  },
}
