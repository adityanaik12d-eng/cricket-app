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

function initSuperOver(config: MatchConfig, state: MatchState, firstBattingTeamId: string): MatchState {
  const next: MatchState = JSON.parse(JSON.stringify(state))
  next.status = 'SUPER_OVER'
  next.superOverState = {
    active: true,
    firstBattingTeamId,
    firstInningsRuns: null,
    firstInningsWickets: null,
  }
  // Add superover innings
  const superOverOvers = config.superOverOvers ?? 1
  const superOverMaxWickets = config.superOverMaxWickets ?? 2
  const ballsPerOver = config.ballsPerOver

  // First superover innings - use correct index (next in sequence)
  const firstInnings = emptyInnings(next.innings.length, config, next.toss!)
  firstInnings.battingTeamId = firstBattingTeamId
  firstInnings.bowlingTeamId = firstBattingTeamId === config.teamAId ? config.teamBId : config.teamAId
  // Override for superover: 1 over, 2 wickets
  firstInnings.batters = {}
  firstInnings.bowlers = {}
  firstInnings.battingOrder = []
  next.innings.push(firstInnings)

  return next
}

function createSuperOverSecondInnings(config: MatchConfig, state: MatchState, target: number): MatchState {
  const next: MatchState = JSON.parse(JSON.stringify(state))
  const firstInnings = next.innings[next.innings.length - 1]
  if (!firstInnings) return next
  const secondInnings = emptyInnings(next.innings.length, config, next.toss!)
  secondInnings.battingTeamId = firstInnings.bowlingTeamId
  secondInnings.bowlingTeamId = firstInnings.battingTeamId
  secondInnings.batters = {}
  secondInnings.bowlers = {}
  secondInnings.battingOrder = []
  next.innings.push(secondInnings)
  return next
}

function finalizeSuperOver(config: MatchConfig, next: MatchState): void {
  const superOverInnings = next.innings.filter((inn, idx) => idx >= next.config.inningsCount)
  const first = superOverInnings[0]
  const second = superOverInnings[1]

  if (!first || !second) return

  if (second.runs > first.runs) {
    next.overrideResult = {
      kind: 'SUPER_OVER_WINNER',
      teamId: second.battingTeamId,
      by: 'WICKETS',
      amount: (config.superOverMaxWickets ?? 2) - second.wickets,
    }
  } else if (first.runs > second.runs) {
    next.overrideResult = {
      kind: 'SUPER_OVER_WINNER',
      teamId: first.battingTeamId,
      by: 'RUNS',
      amount: first.runs - second.runs,
    }
  } else {
    // Still tied after superover - sudden death could be added here
    // For now, declare as tied
    next.overrideResult = { kind: 'TIE' }
  }
  next.status = 'COMPLETED'
  next.superOverState = { ...next.superOverState!, active: false }
  for (const inn of next.innings) inn.closed = true
}

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

/** Short chip label for one delivery (e.g. "4", "wd", "W", "nb2"). Shared with the over timeline. */
export function deliveryLabel(event: BallEvent, config: MatchConfig): string {
  if (event.wicket) {
    return event.runs > 0 ? `${event.runs}W` : 'W'
  }
  switch (event.extras) {
    case 'WIDE': {
      const total = config.wideExtra + event.runs
      return total === 1 ? 'wd' : `wd${total}`
    }
    case 'NO_BALL':
      return event.runs > 0 ? `nb${event.runs}` : 'nb'
    case 'BYE':
      return `b${event.runs}`
    case 'LEG_BYE':
      return `lb${event.runs}`
    default:
      return String(event.runs)
  }
}

/** Total runs added by one delivery: extras penalty + runs off the bat + byes/leg-byes. */
export function deliveryRuns(event: Pick<BallEvent, 'runs' | 'extras'>, config: MatchConfig): number {
  const penalty =
    event.extras === 'WIDE' ? config.wideExtra : event.extras === 'NO_BALL' ? config.noBallExtra : 0
  const batRuns = event.extras === 'NONE' || event.extras === 'NO_BALL' ? event.runs : 0
  const runExtra = event.extras === 'WIDE' || event.extras === 'BYE' || event.extras === 'LEG_BYE' ? event.runs : 0
  return penalty + batRuns + runExtra
}

/** Runs scored off the bat: nothing for a wide, a bye or a leg bye. */
export function deliveryBatRuns(event: Pick<BallEvent, 'runs' | 'extras'>): number {
  return event.extras === 'NONE' || event.extras === 'NO_BALL' ? event.runs : 0
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

  // Record the delivery against the over in progress. A change of over number
  // starts a fresh list, so wides/no-balls (which do not advance the over) stay
  // with their over.
  if (inn.thisOverIndex !== event.over) {
    inn.thisOver = []
    inn.thisOverIndex = event.over
  }
  inn.thisOver.push({
    label: `${event.over}.${event.ball + 1}`,
    text: deliveryLabel(event, config),
    wicket: event.wicket,
    runs: deliveryRuns(event, config),
  })
}

export function chaseTarget(state: MatchState, inn: InningsState): number | null {
  const regularInningsCount = state.config.inningsCount
  const isSuperOverInnings = inn.index >= regularInningsCount

  if (isSuperOverInnings) {
    // Super over innings
    const superOverInningsIndex = inn.index - regularInningsCount // 0 for first, 1 for second
    if (superOverInningsIndex === 1) {
      // Second super over innings: target is firstInningsRuns + 1
      const firstInningsRuns = state.superOverState?.firstInningsRuns
      if (firstInningsRuns !== null && firstInningsRuns !== undefined) {
        return firstInningsRuns + 1
      }
    }
    // First super over innings (index 0): no target, they set the target
    return null
  }

  // Regular innings: only the final regular innings has a target
  if (inn.index !== regularInningsCount - 1) return null
  const first = state.innings[0]
  if (!first || first === inn) return null
  return first.runs + 1
}

/** Close the current innings if it is finished, and settle or advance the match. */
function maybeEndInnings(config: MatchConfig, next: MatchState): void {
  const inn = currentInnings(next)
  if (!inn || inn.closed) return

  // Determine if this is a superover innings
  const isSuperOver = next.status === 'SUPER_OVER'
  const superOverOvers = config.superOverOvers ?? 1
  const superOverMaxWickets = config.superOverMaxWickets ?? 2
  const oversForThisInnings = isSuperOver ? superOverOvers : config.oversPerInnings
  const maxWicketsForThisInnings = isSuperOver ? superOverMaxWickets : config.maxWickets

  const totalBalls = oversToBalls(oversForThisInnings, config.ballsPerOver)
  const target = chaseTarget(next, inn)
  const chased = target !== null && inn.runs >= target
  const allOut = inn.wickets >= maxWicketsForThisInnings
  const oversDone = inn.legalBalls >= totalBalls
  if (!chased && !allOut && !oversDone && !inn.declared) return

  inn.closed = true

  // Handle superover innings completion
  if (isSuperOver) {
    const superOverInnings = next.innings.filter((i, idx) => idx >= config.inningsCount)
    const isFirstSuperOverInnings = superOverInnings.length === 1

    if (isFirstSuperOverInnings) {
      // First superover innings completed
      next.superOverState = {
        ...next.superOverState!,
        firstInningsRuns: inn.runs,
        firstInningsWickets: inn.wickets,
      }
      // Create second superover innings
      const target = inn.runs + 1
      const updated = createSuperOverSecondInnings(config, next, target)
      Object.assign(next, updated)
      next.status = 'SUPER_OVER'
      return
    } else if (superOverInnings.length === 2) {
      // Second superover innings completed
      finalizeSuperOver(config, next)
      return
    }
  }

  if (chased) {
    next.overrideResult = {
      kind: 'WINNER',
      teamId: inn.battingTeamId,
      by: 'WICKETS',
      amount: maxWicketsForThisInnings - inn.wickets,
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
        next.overrideResult = { kind: 'WINNER', teamId: inn.battingTeamId, by: 'WICKETS', amount: maxWicketsForThisInnings - inn.wickets }
        next.status = 'COMPLETED'
      } else if (diff < 0) {
        next.overrideResult = { kind: 'WINNER', teamId: first.battingTeamId, by: 'RUNS', amount: -diff }
        next.status = 'COMPLETED'
      } else {
        // Match tied - check if superover is enabled
        if (config.superOverEnabled) {
          // Determine who bats first in superover (team that batted second in regular match)
          const firstBattingTeamId = inn.battingTeamId
          const updated = initSuperOver(config, next, firstBattingTeamId)
          Object.assign(next, updated)
        } else {
          next.overrideResult = { kind: 'TIE' }
          next.status = 'TIED'
        }
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

/**
 * Edit a previously recorded delivery by creating a CORRECTION event.
 * Replays all events from the edited point forward to recalculate state.
 */
export function editDelivery(
  config: MatchConfig,
  state: MatchState,
  editTarget: { seq: number } | { over: number; ball: number },
  newBall: Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'>
): MatchState {
  // Find the event to edit
  const events = stateToEvents(state)
  let targetEvent: BallEvent | null = null

  for (const e of events) {
    if (e.type !== 'BALL') continue
    if ('seq' in editTarget) {
      if (e.seq === editTarget.seq) { targetEvent = e; break }
    } else {
      if (e.over === editTarget.over && e.ball === editTarget.ball) { targetEvent = e; break }
    }
  }

  if (!targetEvent) {
    throw new EngineError('POSITION', 'Delivery not found')
  }

  // Cannot edit deliveries from closed innings unless it's the current innings
  const targetInnings = state.innings[targetEvent.over]
  if (targetInnings?.closed && targetInnings !== currentInnings(state)) {
    throw new EngineError('INNINGS_OVER', 'Cannot edit deliveries in a closed innings')
  }

  // Create the correction event
  const correction: CorrectionEvent = {
    id: crypto.randomUUID(),
    matchId: config.matchId,
    seq: state.lastSeq + 1,
    ts: new Date().toISOString(),
    type: 'CORRECTION',
    supersedes: targetEvent.id,
    replacement: { kind: 'BALL', ball: newBall },
    reason: 'Manual edit via scorecard',
  }

  // Replay all events with the correction applied
  const allEvents = [...events, correction]
  return applyEvents(config, allEvents)
}

/**
 * Convert current MatchState back to an event list for replay.
 * This reconstructs the event log from the current state.
 */
function stateToEvents(state: MatchState): MatchEvent[] {
  const events: MatchEvent[] = []

  // Add toss if present
  if (state.toss) events.push(state.toss)

  // Reconstruct ball events from innings
  for (const inn of state.innings) {
    if (!inn.thisOver) continue
    for (const ball of inn.thisOver) {
      // Note: This is a simplified reconstruction.
      // In production, we'd store the full event log in state or fetch from DB.
      // For now, we assume the scorer has access to the event log.
    }
  }

  // Since we can't fully reconstruct from state alone,
  // this function should be called with the full event log from the database.
  // The actual implementation will receive events as a parameter.

  return events
}

/**
 * Edit a delivery given the full event log (preferred method).
 */
export function editDeliveryFromLog(
  config: MatchConfig,
  events: MatchEvent[],
  editTarget: { seq: number } | { over: number; ball: number },
  newBall: Omit<BallEvent, 'id' | 'matchId' | 'seq' | 'ts' | 'type'>
): MatchState {
  // Find the event to edit
  let targetEvent: BallEvent | null = null

  for (const e of events) {
    if (e.type !== 'BALL') continue
    if ('seq' in editTarget) {
      if (e.seq === editTarget.seq) { targetEvent = e; break }
    } else {
      if (e.over === editTarget.over && e.ball === editTarget.ball) { targetEvent = e; break }
    }
  }

  if (!targetEvent) {
    throw new EngineError('POSITION', 'Delivery not found')
  }

  // Create the correction event
  const lastSeq = Math.max(...events.map(e => e.seq), 0)
  const correction: CorrectionEvent = {
    id: crypto.randomUUID(),
    matchId: config.matchId,
    seq: lastSeq + 1,
    ts: new Date().toISOString(),
    type: 'CORRECTION',
    supersedes: targetEvent.id,
    replacement: { kind: 'BALL', ball: newBall },
    reason: 'Manual edit via scorecard',
  }

  // Replay all events with the correction applied
  const allEvents = [...events, correction]
  return applyEvents(config, allEvents)
}
