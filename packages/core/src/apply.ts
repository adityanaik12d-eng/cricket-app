import type {
  BallEvent,
  BatterLine,
  BowlerLine,
  CorrectionEvent,
  InningsState,
  MatchConfig,
  MatchEvent,
  MatchState,
} from './types.js'
import { currentInnings, emptyInnings, emptyState } from './state.js'
import { EngineError } from './errors.js'
import { isLegalDelivery, validateDelivery } from './validate.js'
import { oversToBalls } from './overs.js'

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

function findNextBatter(config: MatchConfig, inn: InningsState): string | null {
  const key = inn.battingTeamId === config.teamAId ? 'A' : 'B'
  const played = new Set(inn.battingOrder)
  for (const p of config.lineups[key]) {
    if (!played.has(p)) return p
  }
  return null
}

function swapStrike(inn: InningsState): void {
  const tmp = inn.strikerId
  inn.strikerId = inn.nonStrikerId
  inn.nonStrikerId = tmp
}

function applyWicket(config: MatchConfig, next: MatchState, inn: InningsState, event: BallEvent): void {
  inn.wickets += 1
  const outId = event.dismissedPlayerId ?? event.batterId
  const outLine = ensureBatter(inn, outId)
  outLine.out = true
  outLine.dismissal = event.dismissal
  outLine.outOnSeq = event.seq

  const bowlerCredit =
    event.dismissal !== null && event.dismissal !== 'RUN_OUT' && event.dismissal !== 'OBSTRUCTING'
  if (bowlerCredit) {
    ensureBowler(inn, event.bowlerId).wickets += 1
  }

  const incoming = findNextBatter(config, inn)
  if (incoming) {
    ensureBatter(inn, incoming)
    if (outId === inn.strikerId) {
      inn.strikerId = incoming
    } else if (outId === inn.nonStrikerId) {
      inn.nonStrikerId = incoming
    } else {
      inn.strikerId = incoming
    }
  }
}

function applyBall(config: MatchConfig, next: MatchState, inn: InningsState, event: BallEvent): void {
  // Positions: the first delivery of an innings establishes the pair and bowler.
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

  if (event.wicket) {
    applyWicket(config, next, inn, event)
  }

  // Scoring from an innings break resumes play.
  if (next.status === 'INNINGS_BREAK') {
    next.status = 'IN_PROGRESS'
  }

  // Strike rotation: odd runs run, then end of over.
  if (event.runs % 2 === 1) {
    swapStrike(inn)
  }
  if (legal && inn.legalBalls % config.ballsPerOver === 0) {
    swapStrike(inn)
    inn.lastOverBowlerId = event.bowlerId
    inn.currentBowlerId = null
  }
}

function chaseTarget(state: MatchState, inn: InningsState): number | null {
  if (inn.index !== state.config.inningsCount - 1) return null
  const first = state.innings[0]
  if (!first || first === inn) return null
  return first.runs + 1
}

/** Close the current innings if it is finished, and settle or advance the match. */
function maybeEndInnings(config: MatchConfig, next: MatchState): void {
  const inn = currentInnings(next)
  if (!inn || inn.closed) return

  const totalBalls = oversToBalls(config.oversPerInnings, config.ballsPerOver)
  const target = chaseTarget(next, inn)
  const chased = target !== null && inn.runs >= target
  const allOut = inn.wickets >= config.maxWickets
  const oversDone = inn.legalBalls >= totalBalls
  if (!chased && !allOut && !oversDone && !inn.declared) return

  inn.closed = true

  if (chased) {
    next.overrideResult = {
      kind: 'WINNER',
      teamId: inn.battingTeamId,
      by: 'WICKETS',
      amount: config.maxWickets - inn.wickets,
    }
    next.status = 'COMPLETED'
    return
  }

  const isFinalInnings = inn.index >= config.inningsCount - 1
  if (isFinalInnings) {
    const first = next.innings[0]
    if (first && first !== inn && next.innings.length >= 2) {
      const diff = inn.runs - first.runs
      if (diff > 0) {
        next.overrideResult = { kind: 'WINNER', teamId: inn.battingTeamId, by: 'WICKETS', amount: config.maxWickets - inn.wickets }
        next.status = 'COMPLETED'
      } else if (diff < 0) {
        next.overrideResult = { kind: 'WINNER', teamId: first.battingTeamId, by: 'RUNS', amount: -diff }
        next.status = 'COMPLETED'
      } else {
        next.overrideResult = { kind: 'TIE' }
        next.status = 'TIED'
      }
    } else {
      next.status = 'COMPLETED'
    }
    return
  }

  const nx = emptyInnings(inn.index + 1, config, next.toss)
  nx.battingTeamId = inn.bowlingTeamId
  nx.bowlingTeamId = inn.battingTeamId
  next.innings.push(nx)
  next.status = 'INNINGS_BREAK'
}

export function applyEvent(config: MatchConfig, state: MatchState, event: MatchEvent): MatchState {
  // Validate against the pre-event state so seq checks see the true lastSeq.
  if (event.type === 'BALL') {
    const validation = validateDelivery(config, state, event)
    if (!validation.ok) {
      throw new EngineError(validation.error.code, validation.error.message)
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
    applyBall(config, next, inn, event)
    maybeEndInnings(config, next)
    return next
  }

  if (event.type === 'DECLARE') {
    const inn = currentInnings(next)
    if (!inn) throw new Error('No innings')
    inn.declared = true
    maybeEndInnings(config, next)
    return next
  }

  if (event.type === 'PENALTY') {
    let target: InningsState | null = null
    for (let i = next.innings.length - 1; i >= 0; i--) {
      const candidate = next.innings[i]
      if (candidate && candidate.battingTeamId === event.teamId) {
        target = candidate
        break
      }
    }
    if (!target) throw new Error('No innings for penalised team')
    target.runs += event.runs
    target.extras += event.runs
    maybeEndInnings(config, next)
    return next
  }

  if (event.type === 'END_MATCH') {
    next.overrideResult =
      event.outcome.kind === 'TIE'
        ? { kind: 'TIE' }
        : { kind: 'ABANDONED', reason: event.outcome.reason }
    next.status = event.outcome.kind === 'TIE' ? 'TIED' : 'ABANDONED'
    for (const inn of next.innings) inn.closed = true
    return next
  }

  return next
}

// Index corrections by the event id they supersede. If more than one correction
// supersedes the same event, the LAST one in the log wins (Map.set overwrites) —
// which is the sensible reading of a later correction overriding an earlier one.
function buildCorrections(events: MatchEvent[]): Map<string, CorrectionEvent> {
  const corrections = new Map<string, CorrectionEvent>()
  for (const e of events) {
    if (e.type === 'CORRECTION') corrections.set(e.supersedes, e)
  }
  return corrections
}

// The event as replayed: a correction substitutes its replacement for the event
// it supersedes, borrowing the original's id/seq/ts.
function resolveEffective(e: MatchEvent, corrections: Map<string, CorrectionEvent>): MatchEvent {
  const correction = corrections.get(e.id)
  if (correction && e.type === 'BALL' && correction.replacement.kind === 'BALL') {
    return {
      ...correction.replacement.ball,
      id: e.id,
      matchId: e.matchId,
      seq: e.seq,
      ts: e.ts,
      type: 'BALL',
    }
  }
  if (correction && e.type === 'PENALTY' && correction.replacement.kind === 'PENALTY') {
    return {
      ...correction.replacement.penalty,
      id: e.id,
      matchId: e.matchId,
      seq: e.seq,
      ts: e.ts,
      type: 'PENALTY',
    }
  }
  return e
}

// The scored events after corrections are applied: CORRECTION events are removed
// and each event a correction supersedes is replaced. Consumers that attribute
// effects to individual deliveries (e.g. career fielding stats) must read this
// list, not the raw log, so corrections are honored.
export function effectiveEvents(events: MatchEvent[]): MatchEvent[] {
  const corrections = buildCorrections(events)
  const out: MatchEvent[] = []
  for (const e of events) {
    if (e.type === 'CORRECTION') continue
    out.push(resolveEffective(e, corrections))
  }
  return out
}

export function applyEvents(config: MatchConfig, events: MatchEvent[]): MatchState {
  const corrections = buildCorrections(events)

  let state = emptyState(config)
  for (const e of events) {
    if (e.type === 'CORRECTION') {
      const record: MatchState = JSON.parse(JSON.stringify(state))
      record.lastSeq = e.seq
      record.eventCount = record.eventCount + 1
      state = record
      continue
    }
    state = applyEvent(config, state, resolveEffective(e, corrections))
  }
  return state
}
