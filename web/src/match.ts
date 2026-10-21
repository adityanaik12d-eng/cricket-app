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
import { resultText } from './scoring'

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
  /** The effective event log, so views (e.g. the over timeline) can reproject it. */
  events: MatchEvent[]
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

/**
 * Rewinds the tail of the log by one event, for "undo last ball". The toss is
 * never dropped, so a match cannot be left without one; the input log is left
 * untouched and the caller re-saves the returned copy.
 */
export function withoutLastEvent(events: MatchEvent[]): MatchEvent[] {
  const last = events[events.length - 1]
  if (!last || last.type === 'TOSS') return events
  return events.slice(0, -1)
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
    events,
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

export type SummaryStatus = 'UPCOMING' | 'LIVE' | 'BREAK' | 'DONE'

/** One board card: everything Home needs, and nothing it has to compute itself. */
export interface MatchSummary {
  matchId: string
  teamAId: string
  teamBId: string
  label: string
  score: string | null
  status: SummaryStatus
  statusText: string
  resultText: string | null
  /** Fraction of the current innings quota already bowled (0–1), when known. */
  progress?: number
}

export interface MatchRowInput {
  id: string
  config: unknown
  events: unknown
}

/** A live match and an innings break both look "in play" on the board. */
function summaryStatus(status: MatchState['status']): { status: SummaryStatus; text: string } {
  switch (status) {
    case 'IN_PROGRESS':
      return { status: 'LIVE', text: 'LIVE' }
    case 'INNINGS_BREAK':
      return { status: 'BREAK', text: 'Innings break' }
    case 'COMPLETED':
    case 'TIED':
    case 'ABANDONED':
      return { status: 'DONE', text: 'Result' }
    default:
      return { status: 'UPCOMING', text: 'Yet to start' }
  }
}

/**
 * Replays one stored match into a board card. Uses the same engine as the match
 * screen, so the board can never disagree with the scorecard. Throws if the
 * stored config/events are no longer replayable — `summarizeRows` is the caller
 * that tolerates that.
 */
export function summarize(matchId: string, config: MatchConfig, events: MatchEvent[]): MatchSummary {
  const state = applyEvents(config, events)
  const scorecard = projectScorecard(state)
  const played = scorecard.innings.filter((i) => i.legalBalls > 0 || i.runs > 0 || i.closed)
  const shown = played.length > 0 ? played[played.length - 1] : undefined
  const label = summaryStatus(state.status)
  const summary: MatchSummary = {
    matchId,
    teamAId: config.teamAId,
    teamBId: config.teamBId,
    label: `${config.teamAId} vs ${config.teamBId}`,
    score: shown ? `${shown.runs}-${shown.wickets} (${shown.oversText} ov)` : null,
    status: label.status,
    statusText: label.text,
    resultText: resultText(projectResult(state)),
  }
  if (shown) {
    const quota = config.oversPerInnings * config.ballsPerOver
    summary.progress = quota > 0 ? Math.min(1, shown.legalBalls / quota) : 0
  }
  return summary
}

/**
 * Summarises many rows, silently dropping any that no longer replay (an old
 * schema, a hand-edited row) so one bad match cannot blank the board.
 */
export function summarizeRows(rows: MatchRowInput[]): MatchSummary[] {
  const out: MatchSummary[] = []
  for (const row of rows) {
    try {
      const events = Array.isArray(row.events) ? (row.events as MatchEvent[]) : []
      out.push(summarize(row.id, row.config as MatchConfig, events))
    } catch {
      // Unreplayable rows are skipped, not surfaced.
    }
  }
  return out
}
