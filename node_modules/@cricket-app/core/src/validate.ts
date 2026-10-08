import type { BallEvent, MatchConfig, MatchState } from './types.js'
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
  if (state.status !== 'IN_PROGRESS' && state.status !== 'INNINGS_BREAK') {
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
  if (inn.legalBalls >= oversToBalls(config.oversPerInnings, config.ballsPerOver)) {
    return fail('INNINGS_OVER', 'Over quota exhausted')
  }
  return { ok: true }
}