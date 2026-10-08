import type { BallEvent, MatchConfig, MatchEvent, MatchState } from './types.js'
import { currentInnings, emptyInnings, emptyState } from './state.js'
import { oversToBalls } from './overs.js'
import { validateDelivery } from './validate.js'

export function applyEvent(config: MatchConfig, state: MatchState, event: MatchEvent): MatchState {
  const next: MatchState = JSON.parse(JSON.stringify(state))
  next.lastSeq = event.seq
  next.eventCount = next.eventCount + 1

  if (event.type === 'TOSS') {
    next.toss = event
    next.status = 'IN_PROGRESS'
    if (next.innings.length === 0) {
      next.innings.push(emptyInnings(0, config, event))
    }
    return next
  }

  if (event.type === 'BALL') {
    const validation = validateDelivery(config, next, event)
    if (!validation.ok) {
      throw new Error(validation.error.message)
    }
    const inn = currentInnings(next)
    if (!inn) throw new Error('No innings')
    // Basic accounting
    if (event.wicket) {
      inn.wickets += 1
    }
    inn.runs += event.runs
    if (event.extras === 'NONE' || event.extras === 'BYE' || event.extras === 'LEG_BYE') {
      inn.legalBalls += 1
    } else {
      inn.extras += (event.extras === 'WIDE' || event.extras === 'NO_BALL') ? (config.wideExtra + (event.extras === 'NO_BALL' ? config.noBallExtra - 0 : 0)) : 0 // simplified
    }
    const ballsPerOver = config.ballsPerOver
    const overBalls = oversToBalls(1, ballsPerOver)
    if (inn.legalBalls % overBalls === 0 && inn.legalBalls > 0) {
      // end of over marker conceptually
    }
    return next
  }

  return next
}

export function applyEvents(config: MatchConfig, events: MatchEvent[]): MatchState {
  let state = emptyState(config)
  for (const e of events) {
    state = applyEvent(config, state, e)
  }
  return state
}