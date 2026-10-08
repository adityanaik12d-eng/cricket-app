import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { applyEvents, projectLiveScore, validateMatchConfig, withDefaults } from '@cricket-app/core'
import type { LiveScore, MatchConfig, MatchConfigInput, MatchEvent, MatchState } from '@cricket-app/core'

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

export interface MatchRecord {
  matchId: string
  config: MatchConfig
  events: MatchEvent[]
  state: MatchState
}

export interface MatchUpdate {
  state: MatchState
  live: LiveScore
}

function buildConfig(input: unknown): MatchConfig {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const matchId = typeof raw.matchId === 'string' && raw.matchId.length > 0 ? raw.matchId : randomUUID()
  return withDefaults({ ...raw, matchId } as MatchConfigInput)
}

const EVENT_TYPES = new Set(['BALL', 'TOSS', 'DECLARE', 'PENALTY', 'END_MATCH', 'CORRECTION'])

export class MatchStore extends EventEmitter {
  private readonly matches = new Map<string, MatchRecord>()

  create(input: unknown): MatchRecord {
    const config = buildConfig(input)
    const result = validateMatchConfig(config)
    if (!result.ok) {
      throw new ApiError(400, result.error.code, result.error.message)
    }
    const record: MatchRecord = {
      matchId: config.matchId,
      config,
      events: [],
      state: applyEvents(config, []),
    }
    this.matches.set(record.matchId, record)
    return record
  }

  get(matchId: string): MatchRecord | undefined {
    return this.matches.get(matchId)
  }

  mustGet(matchId: string): MatchRecord {
    const record = this.matches.get(matchId)
    if (!record) throw new ApiError(404, 'NOT_FOUND', `Match ${matchId} not found`)
    return record
  }

  append(matchId: string, payload: unknown): { event: MatchEvent; state: MatchState; live: LiveScore } {
    const record = this.mustGet(matchId)
    const raw = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
    const type = raw.type
    if (typeof type !== 'string' || !EVENT_TYPES.has(type)) {
      throw new ApiError(400, 'INVALID_FORMAT', `Unknown event type: ${String(type)}`)
    }
    const event = {
      ...raw,
      id: randomUUID(),
      matchId,
      seq: record.state.lastSeq + 1,
      ts: new Date().toISOString(),
    } as MatchEvent
    const events = [...record.events, event]
    // Recompute from the full log so corrections (which replay superseded
    // events) are handled by the engine; assign only after a clean apply.
    const state = applyEvents(record.config, events)
    record.events = events
    record.state = state
    const live = projectLiveScore(state)
    this.emit('update', matchId, { state, live } satisfies MatchUpdate)
    return { event, state, live }
  }
}
