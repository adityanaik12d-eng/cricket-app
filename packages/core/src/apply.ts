import type { BallEvent, BatterLine, BowlerLine, InningsState, MatchConfig, MatchEvent, MatchState } from './types.js'
import { currentInnings, emptyInnings, emptyState } from './state.js'
import { isLegalDelivery, validateDelivery } from './validate.js'

function ensureBatter(inn: InningsState, playerId: string): BatterLine {
  let line = inn.batters[playerId]
  if (!line) {
    line = { playerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: null, outOnSeq: null }
    inn.batters[playerId] = line
  }
  if (!inn.battingOrder.includes(playerId)) {
    inn.battingOrder.push(playerId)
  }
  return line
}

function ensureBowler(inn: InningsState, playerId: string): BowlerLine {
  let line = inn.bowlers[playerId]
  if (!line) {
    line = { playerId, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 }
    inn.bowlers[playerId] = line
  }
  return line
}

function applyBall(config: MatchConfig, inn: InningsState, event: BallEvent): void {
  // Positions: the first delivery establishes the pair and bowler.
  if (!inn.strikerId) {
    inn.strikerId = event.batterId
    inn.nonStrikerId = event.nonStrikerId
  }
  if (!inn.currentBowlerId) {
    inn.currentBowlerId = event.bowlerId
  }

  const legal = isLegalDelivery(event.extras)
  const penalty =
    event.extras === 'WIDE' ? config.wideExtra : event.extras === 'NO_BALL' ? config.noBallExtra : 0
  const batRuns = event.extras === 'NONE' || event.extras === 'NO_BALL' ? event.runs : 0
  const runExtra = event.extras === 'WIDE' || event.extras === 'BYE' || event.extras === 'LEG_BYE' ? event.runs : 0

  inn.runs += penalty + batRuns + runExtra
  inn.extras += penalty + runExtra
  if (legal) {
    inn.legalBalls += 1
  }

  if (legal || batRuns > 0) {
    const striker = ensureBatter(inn, event.batterId)
    striker.balls += legal ? 1 : 0
    striker.runs += batRuns
    if (batRuns === 4) striker.fours += 1
    if (batRuns === 6) striker.sixes += 1
    if (legal && event.nonStrikerId) {
      ensureBatter(inn, event.nonStrikerId)
    }
  }

  const bowler = ensureBowler(inn, event.bowlerId)
  bowler.balls += legal ? 1 : 0
  if (event.extras !== 'BYE' && event.extras !== 'LEG_BYE') {
    bowler.runs += penalty + batRuns + runExtra
  }
  if (event.extras === 'WIDE') bowler.wides += 1
  if (event.extras === 'NO_BALL') bowler.noBalls += 1

  // Strike rotation: odd runs run, then end of over.
  if (event.runs % 2 === 1) {
    const tmp = inn.strikerId
    inn.strikerId = inn.nonStrikerId
    inn.nonStrikerId = tmp
  }
  if (legal && inn.legalBalls % config.ballsPerOver === 0) {
    const tmp = inn.strikerId
    inn.strikerId = inn.nonStrikerId
    inn.nonStrikerId = tmp
    inn.lastOverBowlerId = event.bowlerId
    inn.currentBowlerId = null
  }
}

export function applyEvent(config: MatchConfig, state: MatchState, event: MatchEvent): MatchState {
  // Validate against the pre-event state so seq checks see the true lastSeq.
  if (event.type === 'BALL') {
    const validation = validateDelivery(config, state, event)
    if (!validation.ok) {
      throw new Error(validation.error.message)
    }
  }

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
    const inn = currentInnings(next)
    if (!inn) throw new Error('No innings')
    applyBall(config, inn, event)
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
