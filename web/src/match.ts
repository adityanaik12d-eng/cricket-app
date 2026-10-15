import {
  applyEvents,
  projectCommentary,
  projectLiveScore,
  projectResult,
  projectScorecard,
  validateMatchConfig,
  withDefaults,
} from '@cricket-app/core'
import type {
  CommentaryLine,
  LiveScore,
  MatchConfig,
  MatchConfigInput,
  MatchEvent,
  MatchResult,
  MatchState,
  Scorecard,
} from '@cricket-app/core'

/**
 * Everything the UI needs to render a match, computed from a config + event log.
 * This is the same shape the old REST API returned, so the scoring UI is
 * unchanged — only the storage behind it moved to Supabase.
 */
export interface MatchBundle {
  matchId: string
  state: MatchState
  live: LiveScore
  scorecard: Scorecard
  result: MatchResult | null
}

export class MatchError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'MatchError'
    this.code = code
  }
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'BALL',
  'TOSS',
  'DECLARE',
  'PENALTY',
  'END_MATCH',
  'CORRECTION',
])

/** Turns the raw setup input into a validated engine config, filling in defaults. */
export function buildConfig(input: unknown, matchId: string): MatchConfig {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const config = withDefaults({ ...raw, matchId } as MatchConfigInput)
  const result = validateMatchConfig(config)
  if (!result.ok) throw new MatchError(result.error.message, result.error.code)
  return config
}

/** The log is append-only, so the next seq simply continues from the last one. */
export function nextSeq(events: MatchEvent[]): number {
  const last = events[events.length - 1]
  return (last ? last.seq : 0) + 1
}

/** Stamps a raw payload with the envelope (id/matchId/seq/ts) the engine expects. */
export function buildEvent(
  matchId: string,
  seq: number,
  payload: unknown,
  uuid: string,
  now: string,
): MatchEvent {
  const raw = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const type = raw.type
  if (typeof type !== 'string' || !EVENT_TYPES.has(type)) {
    throw new MatchError(`Unknown event type: ${String(type)}`, 'INVALID_FORMAT')
  }
  return { ...raw, id: uuid, matchId, seq, ts: now, type } as MatchEvent
}

/** Replays the log into state, live score, scorecard and result. Pure: no I/O. */
export function computeBundle(matchId: string, config: MatchConfig, events: MatchEvent[]): MatchBundle {
  const state = applyEvents(config, events)
  return {
    matchId,
    state,
    live: projectLiveScore(state),
    scorecard: projectScorecard(state),
    result: projectResult(state),
  }
}

export function computeCommentary(config: MatchConfig, events: MatchEvent[]): CommentaryLine[] {
  return projectCommentary(config, events)
}

/**
 * Appends one event to the log and replays it. Engine validation failures
 * surface as MatchError so the UI can show them inline.
 */
export function appendEvent(input: {
  matchId: string
  config: MatchConfig
  events: MatchEvent[]
  payload: unknown
  uuid: string
  now: string
}): { event: MatchEvent; events: MatchEvent[]; state: MatchState; live: LiveScore } {
  const event = buildEvent(input.matchId, nextSeq(input.events), input.payload, input.uuid, input.now)
  const events = [...input.events, event]
  let state: MatchState
  try {
    state = applyEvents(input.config, events)
  } catch (err) {
    if (err instanceof MatchError) throw err
    throw new MatchError(err instanceof Error ? err.message : 'Invalid event', 'INVALID_EVENT')
  }
  return { event, events, state, live: projectLiveScore(state) }
}
