import type { LiveScore, MatchResult, MatchState, Scorecard } from '@cricket-app/core'

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
  oversPerInnings: number
  powerplayOvers: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
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
}
