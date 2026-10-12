import type { CommentaryLine, LiveScore, MatchResult, MatchState, Scorecard } from '@cricket-app/core'
import { getToken } from './token'

export class ApiRequestError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
  }
}

export interface MatchBundle {
  matchId: string
  state: MatchState
  live: LiveScore
  scorecard: Scorecard
  result: MatchResult | null
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = getToken()
  if (token && !path.startsWith('/auth/')) headers.authorization = `Bearer ${token}`
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...((init?.headers as Record<string, string> | undefined) ?? {}) },
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body as { error?: string; code?: string } | null
    throw new ApiRequestError(err?.error ?? res.statusText, err?.code ?? `HTTP_${res.status}`)
  }
  return body as T
}

export const api = {
  createMatch(cfg: CreateMatchBody): Promise<{ matchId: string; state: MatchState; live: LiveScore }> {
    return request('/matches', { method: 'POST', body: JSON.stringify(cfg) })
  },
  getMatch(matchId: string): Promise<MatchBundle> {
    return request(`/matches/${matchId}`)
  },
  postEvent(
    matchId: string,
    payload: unknown,
  ): Promise<{ seq: number; state: MatchState; live: LiveScore }> {
    return request(`/matches/${matchId}/events`, { method: 'POST', body: JSON.stringify(payload) })
  },
  requestOtp(mobile: string): Promise<{ ok: true; devOtp?: string }> {
    return request('/auth/otp', { method: 'POST', body: JSON.stringify({ mobile }) })
  },
  verifyOtp(mobile: string, otp: string): Promise<AuthResponse> {
    return request('/auth/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) })
  },
  register(mobile: string, otp: string, name: string): Promise<AuthResponse> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify({ mobile, otp, name }) })
  },
  getMe(): Promise<{ player: Player }> {
    return request('/me')
  },
  patchMe(patch: Record<string, unknown>): Promise<{ player: Player }> {
    return request('/me', { method: 'PATCH', body: JSON.stringify(patch) })
  },
  searchPlayers(q: string): Promise<{ players: Player[] }> {
    return request(`/players?q=${encodeURIComponent(q)}`)
  },
  createPlayer(mobile: string, name: string): Promise<{ player: Player }> {
    return request('/players', { method: 'POST', body: JSON.stringify({ mobile, name }) })
  },
  getPlayerStats(id: string): Promise<CareerStats> {
    return request(`/players/${id}/stats`)
  },
  getCommentary(matchId: string): Promise<{ commentary: CommentaryLine[] }> {
    return request(`/matches/${matchId}/commentary`)
  },
}
