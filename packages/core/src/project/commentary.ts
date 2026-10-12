import type { BallEvent, CommentaryLine, Dismissal, MatchConfig, MatchEvent } from '../types.js'
import { effectiveEvents } from '../apply.js'

function name(config: MatchConfig, id: string | null | undefined): string {
  if (!id) return 'unknown'
  return config.playerRefs?.[id]?.name ?? id
}

function runsText(runs: number): string {
  if (runs === 0) return 'no run'
  if (runs === 4) return 'FOUR'
  if (runs === 6) return 'SIX'
  return runs === 1 ? '1 run' : `${runs} runs`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function dismissalText(dismissal: Dismissal, fielder: string | null): string {
  switch (dismissal) {
    case 'BOWLED':
      return 'bowled'
    case 'LBW':
      return 'lbw'
    case 'CAUGHT':
      return fielder ? `caught by ${fielder}` : 'caught'
    case 'STUMPED':
      return fielder ? `stumped by ${fielder}` : 'stumped'
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : 'run out'
    case 'HIT_WICKET':
      return 'hit wicket'
    case 'OBSTRUCTING':
      return 'obstructing the field'
    default:
      return 'out'
  }
}

function deliveryText(config: MatchConfig, e: BallEvent): string {
  switch (e.extras) {
    case 'WIDE': {
      const total = config.wideExtra + e.runs
      return total === 1 ? 'wide' : `${total} wides`
    }
    case 'NO_BALL':
      return e.runs > 0 ? `no ball, ${runsText(e.runs)}` : 'no ball'
    case 'BYE':
      return plural(e.runs, 'bye')
    case 'LEG_BYE':
      return plural(e.runs, 'leg bye')
    default:
      return runsText(e.runs)
  }
}

function ballText(config: MatchConfig, e: BallEvent): string {
  const head = `${e.over}.${e.ball + 1} ${name(config, e.bowlerId)} to ${name(config, e.batterId)}`
  if (e.wicket) {
    const fielder = e.fielderId ? name(config, e.fielderId) : null
    const dismissal = e.dismissal ? dismissalText(e.dismissal, fielder) : 'out'
    return `${head}, WICKET! ${name(config, e.dismissedPlayerId ?? e.batterId)} ${dismissal}`
  }
  return `${head}, ${deliveryText(config, e)}`
}

/**
 * Ball-by-ball commentary derived from the event log. Corrections are honoured
 * (superseded deliveries are replaced, not repeated). Lines are chronological;
 * a display may reverse them to put the latest delivery first.
 */
export function projectCommentary(config: MatchConfig, events: MatchEvent[]): CommentaryLine[] {
  const lines: CommentaryLine[] = []
  let lastOver: number | null = null

  for (const e of effectiveEvents(events)) {
    if (e.type === 'TOSS') {
      lines.push({
        seq: e.seq,
        kind: 'TOSS',
        over: null,
        text: `${e.winnerTeamId} won the toss and chose to ${e.winnerDecision.toLowerCase()}`,
      })
      continue
    }
    if (e.type === 'DECLARE') {
      lines.push({ seq: e.seq, kind: 'INNINGS', over: null, text: 'Innings declared' })
      lastOver = null
      continue
    }
    if (e.type === 'PENALTY') {
      lines.push({ seq: e.seq, kind: 'INNINGS', over: null, text: `Penalty runs: ${e.runs} to ${e.teamId}` })
      lastOver = null
      continue
    }
    if (e.type === 'END_MATCH') {
      const text =
        e.outcome.kind === 'TIE'
          ? 'Match tied'
          : `Match abandoned${e.outcome.reason ? `: ${e.outcome.reason}` : ''}`
      lines.push({ seq: e.seq, kind: 'END', over: null, text })
      continue
    }
    if (e.type !== 'BALL') continue

    // Overs reset when a new innings starts: close the previous block.
    if (lastOver !== null && e.over < lastOver) {
      lines.push({ seq: e.seq, kind: 'INNINGS', over: null, text: 'Innings break' })
      lastOver = null
    }
    if (lastOver === null || e.over !== lastOver) {
      lines.push({ seq: e.seq, kind: 'OVER', over: null, text: `Over ${e.over + 1}` })
      lastOver = e.over
    }
    lines.push({ seq: e.seq, kind: e.wicket ? 'WICKET' : 'BALL', over: `${e.over}.${e.ball + 1}`, text: ballText(config, e) })
  }

  return lines
}
