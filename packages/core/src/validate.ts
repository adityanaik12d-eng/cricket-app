import type { BallEvent, CorrectionEvent, MatchConfig, MatchEvent, MatchState } from './types.js'
import type { ValidationResult } from './errors.js'
import { currentInnings } from './state.js'
import { oversToBalls } from './overs.js'

function fail(code: any, message: string): ValidationResult {
  return { ok: false, error: { code, message } }
}

export function isWide(extras: BallEvent['extras']): boolean {
  return extras === 'WIDE'
}

export function isNoBall(extras: BallEvent['extras']): boolean {
  return extras === 'NO_BALL'
}

export function isLegalDelivery(extras: BallEvent['extras']): boolean {
  return extras === 'NONE' || extras === 'BYE' || extras === 'LEG_BYE'
}

export function validateDelivery(config: MatchConfig, state: MatchState, event: BallEvent): ValidationResult {
  if (state.status !== 'IN_PROGRESS' && state.status !== 'INNINGS_BREAK' && state.status !== 'SUPER_OVER') {
    return fail('STATUS', 'Match not in progress')
  }
  const inn = currentInnings(state)
  if (!inn) return fail('POSITION', 'No current innings')
  if (inn.closed) return fail('INNINGS_OVER', 'Innings is closed')
  if (event.seq <= state.lastSeq) {
    return fail('DUPLICATE_SEQ', 'Sequence already processed')
  }
  if (event.over < 0 || event.ball < 0) {
    return fail('POSITION', 'Invalid position')
  }
  if (
    event.batterId === event.bowlerId ||
    event.nonStrikerId === event.bowlerId ||
    inn.strikerId === event.bowlerId ||
    inn.nonStrikerId === event.bowlerId
  ) {
    return fail('BOWLER_IS_BATTER', 'Bowler must not be batting')
  }
  if (inn.strikerId && event.batterId !== inn.strikerId) {
    return fail('POSITION', 'Batter is not on strike')
  }
  if (!inn.currentBowlerId && inn.lastOverBowlerId === event.bowlerId) {
    return fail('CONSECUTIVE_OVERS', 'Bowler cannot bowl consecutive overs')
  }

  // Use superover config when in superover
  const isSuperOver = state.status === 'SUPER_OVER'
  const maxOversPerBowler = isSuperOver ? (config.superOverOvers ?? 1) : config.maxOversPerBowler
  const oversPerInnings = isSuperOver ? (config.superOverOvers ?? 1) : config.oversPerInnings
  const maxWickets = isSuperOver ? (config.superOverMaxWickets ?? 2) : config.maxWickets

  const quotaBalls = oversToBalls(maxOversPerBowler, config.ballsPerOver)
  const bowlerLine = inn.bowlers[event.bowlerId]
  const futureBalls = (bowlerLine ? bowlerLine.balls : 0) + (isLegalDelivery(event.extras) ? 1 : 0)
  if (futureBalls > quotaBalls) {
    return fail('BOWLER_QUOTA', 'Bowler over quota')
  }
  if (inn.wickets >= maxWickets) {
    return fail('WICKETS_LIMIT', 'All wickets are out')
  }
  if (inn.legalBalls >= oversToBalls(oversPerInnings, config.ballsPerOver)) {
    return fail('INNINGS_OVER', 'Over quota exhausted')
  }
  return { ok: true }
}

export function validateCorrection(
  config: MatchConfig,
  state: MatchState,
  event: CorrectionEvent,
  allEvents: MatchEvent[]
): ValidationResult {
  // Allow corrections in these states
  if (state.status !== 'IN_PROGRESS' && state.status !== 'INNINGS_BREAK' && state.status !== 'SUPER_OVER') {
    return fail('STATUS', 'Match not in progress')
  }

  // Find the event being superseded
  const targetEvent = allEvents.find((e) => e.id === event.supersedes)
  if (!targetEvent) {
    return fail('NOT_FOUND', 'Event to correct not found')
  }
  if (targetEvent.type !== 'BALL') {
    return fail('INVALID_TARGET', 'Only ball events can be corrected')
  }

  // Validate the replacement ball
  if (event.replacement.kind !== 'BALL') {
    return fail('INVALID_REPLACEMENT', 'Only ball replacements are supported')
  }

  const newBall = event.replacement.ball
  // Validate the new ball data using the same rules as a regular delivery
  // but against the state at the time of the original delivery
  // For simplicity, we validate against current state (caller should replay to get exact state)
  return validateDelivery(config, state, {
    ...newBall,
    id: targetEvent.id,
    matchId: config.matchId,
    seq: targetEvent.seq,
    ts: targetEvent.ts,
    type: 'BALL',
  })
}