import { Fragment, useMemo, useState } from 'react'
import type {
  BatterBall,
  CommentaryLine,
  InningsCard,
  MatchConfig,
  MatchEvent,
  MatchState,
  Scorecard,
} from '@cricket-app/core'
import { projectBatterBalls, projectPartnerships, effectiveEvents } from '@cricket-app/core'
import { formatWin, playerName } from './scoring'
import { formatBowlerFigures } from './scoring'

/** Splits the effective event log into per-innings arrays, mirroring projectTimeline's innings detection. */
function splitEventsByInnings(events: MatchEvent[]): MatchEvent[][] {
  const out: MatchEvent[][] = []
  let innings = -1
  let lastOver: number | null = null
  let lastBall = -1
  for (const event of effectiveEvents(events)) {
    if (event.type !== 'BALL') continue
    if (lastOver !== null && (event.over < lastOver || (event.over === lastOver && event.ball < lastBall))) {
      innings += 1
      lastOver = null
    }
    if (innings < 0) {
      innings = 0
    }
    if (!out[innings]) out[innings] = []
    const arr = out[innings]!
    arr.push(event)
    if (lastOver === null || event.over !== lastOver) {
      lastOver = event.over
    }
    lastBall = event.ball
  }
  return out
}

interface ExtrasBreakdown {
  byes: number
  legByes: number
  wides: number
  noBalls: number
  total: number
}

function computeExtrasBreakdown(inningsEvents: MatchEvent[]): ExtrasBreakdown {
  const result: ExtrasBreakdown = { byes: 0, legByes: 0, wides: 0, noBalls: 0, total: 0 }
  for (const e of inningsEvents) {
    if (e.type !== 'BALL') continue
    const ev = e as { extras: string; runs: number }
    if (ev.extras === 'BYE') {
      result.byes += ev.runs
      result.total += ev.runs
    } else if (ev.extras === 'LEG_BYE') {
      result.legByes += ev.runs
      result.total += ev.runs
    } else if (ev.extras === 'WIDE') {
      result.wides += (ev.runs > 0 ? ev.runs : 1)
      result.total += (ev.runs > 0 ? ev.runs : 1)
    } else if (ev.extras === 'NO_BALL') {
      result.noBalls += 1
      result.total += 1 + (ev.runs > 0 ? ev.runs : 0)
    }
  }
  return result
}

function computeMaidens(inningsEvents: MatchEvent[], ballsPerOver: number): Map<string, number> {
  const maidens = new Map<string, number>()
  // Group deliveries by bowler and over
  const bowlerOvers = new Map<string, Map<number, number>>()
  for (const e of inningsEvents) {
    if (e.type !== 'BALL') continue
    const ev = e as { bowlerId: string; over: number; extras: string; runs: number }
    if (!bowlerOvers.has(ev.bowlerId)) bowlerOvers.set(ev.bowlerId, new Map())
    const overs = bowlerOvers.get(ev.bowlerId)!
    if (!overs.has(ev.over)) overs.set(ev.over, 0)
    // Add runs to this over (including extras)
    let overRuns = overs.get(ev.over)!
    if (ev.extras === 'WIDE') {
      overRuns += ev.runs > 0 ? ev.runs : 1
    } else if (ev.extras === 'NO_BALL') {
      overRuns += 1 + (ev.runs > 0 ? ev.runs : 0)
    } else if (ev.extras === 'BYE' || ev.extras === 'LEG_BYE') {
      overRuns += ev.runs
    } else {
      overRuns += ev.runs
    }
    overs.set(ev.over, overRuns)
  }
  for (const [bowlerId, overs] of bowlerOvers) {
    let count = 0
    for (const [, runs] of overs) {
      if (runs === 0) count++
    }
    maidens.set(bowlerId, count)
  }
  return maidens
}

function computePowerplayScore(inningsEvents: MatchEvent[], powerplayOvers: number): { runs: number; wickets: number } | null {
  let runs = 0
  let wickets = 0
  let hasBalls = false
  for (const e of inningsEvents) {
    if (e.type !== 'BALL') continue
    const ev = e as { over: number; extras: string; runs: number; wicket: boolean }
    if (ev.over >= powerplayOvers) continue
    hasBalls = true
    if (ev.extras === 'WIDE') {
      runs += ev.runs > 0 ? ev.runs : 1
    } else if (ev.extras === 'NO_BALL') {
      runs += 1 + (ev.runs > 0 ? ev.runs : 0)
    } else if (ev.extras === 'BYE' || ev.extras === 'LEG_BYE') {
      runs += ev.runs
    } else {
      runs += ev.runs
    }
    if (ev.wicket) wickets++
  }
  if (!hasBalls) return null
  return { runs, wickets }
}

interface DismissalDetail {
  batterId: string
  text: string
}

function buildDismissalMap(inningsEvents: MatchEvent[], config: MatchConfig): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of inningsEvents) {
    if (e.type !== 'BALL') continue
    const ev = e as {
      wicket: boolean
      dismissedPlayerId: string | null
      batterId: string
      dismissal: string | null
      bowlerId: string
      fielderId?: string
    }
    if (!ev.wicket) continue
    const dismissedId = ev.dismissedPlayerId ?? ev.batterId
    const bowlerName = playerName(config, ev.bowlerId)
    const fielderName = ev.fielderId ? playerName(config, ev.fielderId) : null
    const dismissal = ev.dismissal
    let text = ''
    if (dismissal === 'BOWLED') {
      text = `b ${bowlerName}`
    } else if (dismissal === 'CAUGHT') {
      text = fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`
    } else if (dismissal === 'LBW') {
      text = `lbw b ${bowlerName}`
    } else if (dismissal === 'STUMPED') {
      text = fielderName ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`
    } else if (dismissal === 'RUN_OUT') {
      text = fielderName ? `run out (${fielderName})` : 'run out'
    } else if (dismissal === 'HIT_WICKET') {
      text = `hit wicket b ${bowlerName}`
    } else if (dismissal === 'OBSTRUCTING') {
      text = 'obstructing the field'
    } else {
      text = dismissal ? dismissal.toLowerCase().replace(/_/g, ' ') : 'out'
    }
    map.set(dismissedId, text)
  }
  return map
}

interface Props {
  bundle: {
    state: MatchState
    scorecard: Scorecard
  }
  commentary?: CommentaryLine[]
  /** The match event log — the ball-by-ball of every batter is derived from it. */
  events: MatchEvent[]
}

/** Identifies one batting row: the innings it belongs to and its batting position. */
export function batterRowKey(inningsIndex: number, position: number): string {
  return `${inningsIndex}-${position}`
}

/**
 * Opens a closed row and closes an open one. Every other row is left alone, so
 * expanding one batter never collapses another.
 */
export function toggleRowKey(expanded: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(expanded)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

export interface BatterBallsProps {
  balls: BatterBall[]
}

/** The ball-by-ball of one batter, as a row of chips. */
export function BatterBalls({ balls }: BatterBallsProps) {
  if (balls.length === 0) {
    return <p className="muted batter-balls-empty">No balls recorded yet.</p>
  }
  return (
    <ol className="batter-balls">
      {balls.map((ball) => (
        <li
          key={ball.seq}
          className={`batter-ball${ball.boundary ? ' is-boundary' : ''}${ball.wicket ? ' is-wicket' : ''}`}
        >
          <span className="batter-ball-label">{ball.label}</span>
          <span className="batter-ball-runs">{ball.runs}</span>
          {ball.wicket ? <span className="batter-ball-mark">W</span> : null}
        </li>
      ))}
    </ol>
  )
}

export interface BattingTableProps {
  state: MatchState
  innings: InningsCard
  events: MatchEvent[]
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
}

/** The batting card: every row can be opened to show that batter's ball-by-ball. */
export function BattingTable({ state, innings, events, expanded, onToggle }: BattingTableProps) {
  const dismissalMap = useMemo(() => buildDismissalMap(
    // We only have events for the whole match, not per innings. But the dismissal
    // map is built from wicket events, and the innings index is used to split.
    // For simplicity, build from all events and let the innings filter happen
    // naturally (wicket events belong to specific innings).
    events,
    state.config,
  ), [events, state.config])

  // Filter dismissal map to only wickets in this innings by checking if the
  // dismissed batter is in this innings' batting list
  const inningsBatterIds = new Set(innings.batting.map((b) => b.playerId))

  return (
    <div className="table-wrap">
      <table className="ledger-table">
        <thead>
          <tr>
            <th>Batter</th>
            <th className="num">R</th>
            <th className="num">B</th>
            <th className="num">4s</th>
            <th className="num">6s</th>
            <th className="num">SR</th>
            <th>Dismissal</th>
          </tr>
        </thead>
        <tbody>
          {innings.batting.map((b) => {
            const key = batterRowKey(innings.index, b.position)
            const open = expanded.has(key)
            const panelId = `batter-balls-${innings.index}-${b.position}`
            const balls = open ? projectBatterBalls(events, b.playerId, innings.index) : []
            const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : '-'
            let dismissalText: string
            if (!b.out) {
              dismissalText = 'not out'
            } else if (inningsBatterIds.has(b.playerId) && dismissalMap.has(b.playerId)) {
              dismissalText = dismissalMap.get(b.playerId)!
            } else {
              dismissalText = b.dismissal ? b.dismissal.replace(/_/g, ' ').toLowerCase() : 'out'
            }
            return (
              <Fragment key={b.playerId}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="row-toggle"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => onToggle(key)}
                    >
                      <span className="row-toggle-caret" aria-hidden="true">
                        {open ? '\u25be' : '\u25b8'}
                      </span>
                      <span className="row-toggle-name">{playerName(state.config, b.playerId)}</span>
                      <span className="visually-hidden"> — ball-by-ball</span>
                    </button>
                    {b.isStriker ? ' *' : b.isNonStriker ? ' \u2020' : ''}
                  </td>
                  <td className="num">{b.runs}</td>
                  <td className="num">{b.balls}</td>
                  <td className="num">{b.fours}</td>
                  <td className="num">{b.sixes}</td>
                  <td className="num muted">{sr}</td>
                  <td className="dismissal">{dismissalText}</td>
                </tr>
                <tr id={panelId} className="batter-balls-row" hidden={!open}>
                  <td className="batter-balls-cell" colSpan={7}>
                    {open ? <BatterBalls balls={balls} /> : null}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ScorecardView({ bundle, commentary, events }: Props) {
  const { state, scorecard } = bundle
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  const onToggle = (key: string) => setExpanded((prev) => toggleRowKey(prev, key))

  // Split events by innings for per-innings computations
  const inningsEvents = useMemo(() => splitEventsByInnings(events), [events])

  // Fall of wickets from partnerships
  const partnerships = useMemo(() => {
    try {
      return projectPartnerships(state.config, events)
    } catch {
      return []
    }
  }, [state.config, events])

  if (scorecard.innings.length === 0) {
    return (
      <section className="card empty-state">
        <p className="empty-state-text">No innings yet - record the toss to start.</p>
      </section>
    )
  }

  // Current innings for header display
  const currentInnings = scorecard.innings[scorecard.innings.length - 1]
  const currentRuns = currentInnings.runs ?? 0
  const currentWickets = currentInnings.wickets ?? 0
  const currentOvers = currentInnings.oversText ?? '0'
  const currentRunRate = typeof currentInnings.runRate === 'number' ? currentInnings.runRate : 0
  const battingTeam = currentInnings.battingTeamId ?? 'Batting'

  return (
    <div className="scorecards">
      {/* Score Header - Shows current match status above scorecard */}
      <header className="scorecard-header card">
        <div className="scorecard-header-row">
          <div className="scorecard-score">
            <span className="scorecard-runs">{currentRuns}-{currentWickets}</span>
            <span className="scorecard-overs">({currentOvers} ov)</span>
          </div>
          <div className="scorecard-meta">
            <span>CRR {currentRunRate.toFixed(2)}</span>
            {currentInnings.target != null && (
              <span>
                Target {currentInnings.target} · Need {Math.max(0, currentInnings.target - currentRuns)} off {currentInnings.ballsRemaining ?? 0}
                {currentInnings.requiredRunRate != null && ` · RRR ${currentInnings.requiredRunRate.toFixed(2)}`}
              </span>
            )}
          </div>
        </div>
        <div className="scorecard-teams">
          <span className="scorecard-batting">{battingTeam} batting</span>
        </div>
      </header>
      {scorecard.innings.map((inn, idx) => {
        const innEvents = inningsEvents[idx] ?? []
        const maidens = computeMaidens(innEvents, state.config.ballsPerOver)
        const extrasBreakdown = computeExtrasBreakdown(innEvents)
        const powerplay = computePowerplayScore(innEvents, state.config.powerplayOvers)
        const innPartnerships = partnerships[idx] ?? []
        const fallOfWickets = innPartnerships
          .filter((p) => p.fallOfWicket)
          .map((p) => p.fallOfWicket!)

        return (
          <section className="card innings-card" key={inn.index}>
            <header className="innings-header">
              <div className="innings-header-top">
                <h2 className="innings-team">{inn.battingTeamId}</h2>
                <div className="innings-scoreblock">
                  <span className="innings-total">{inn.runs}-{inn.wickets}</span>
                  <span className="innings-overs-text">({inn.oversText} ov)</span>
                </div>
              </div>
              <div className="innings-meta">
                <span>Run Rate: {inn.runRate.toFixed(2)}</span>
                {powerplay && (
                  <span>Powerplay: {powerplay.runs}/{powerplay.wickets}</span>
                )}
                {inn.index === 0 && state.toss && (
                  <span>
                    {state.toss.winnerTeamId} won the toss and chose to {state.toss.winnerDecision.toLowerCase()}
                  </span>
                )}
                {inn.declared ? <span> • Declared</span> : null}
                {inn.closed && !inn.declared ? <span> • Innings Complete</span> : null}
              </div>
            </header>

            <BattingTable
              state={state}
              innings={inn}
              events={events}
              expanded={expanded}
              onToggle={onToggle}
            />

            <div className="extras-row">
              <span>Extras</span>
              <span>
                {inn.extras}
                {extrasBreakdown.total > 0 && innEvents.length > 0 && (
                  <span className="muted">
                    {' '}(b {extrasBreakdown.byes}, lb {extrasBreakdown.legByes}, w {extrasBreakdown.wides}, nb {extrasBreakdown.noBalls})
                  </span>
                )}
              </span>
            </div>
            <div className="total-row">
              <span>Total</span>
              <span>
                {inn.runs}/{inn.wickets} ({inn.oversText} ov)
              </span>
            </div>

            {fallOfWickets.length > 0 && (
              <>
                <h3 className="section-title">Fall of Wickets</h3>
                <div className="fall-of-wickets">
                  {fallOfWickets.map((fow) => (
                    <span key={fow.seq} className="fow-item">
                      {fow.wickets}-{fow.runs} ({playerName(state.config, fow.dismissedPlayerId)}, {fow.over} ov)
                    </span>
                  ))}
                </div>
              </>
            )}

            <h3 className="section-title">Bowling</h3>
            <div className="table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Bowler</th>
                    <th className="num">O</th>
                    <th className="num">M</th>
                    <th className="num">R</th>
                    <th className="num">W</th>
                    <th className="num">Econ</th>
                    <th className="num">WD</th>
                    <th className="num">NB</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowling.map((b) => (
                    <tr key={b.playerId}>
                      <td>
                        {playerName(state.config, b.playerId)}
                        {b.isCurrentBowler ? ' *' : ''}
                      </td>
                      <td className="num">{b.oversText}</td>
                      <td className="num">{innEvents.length > 0 ? (maidens.get(b.playerId) ?? 0) : 0}</td>
                      <td className="num">{b.runs}</td>
                      <td className="num">{b.wickets}</td>
                      <td className="num">{b.economy.toFixed(2)}</td>
                      <td className="num">{b.wides}</td>
                      <td className="num">{b.noBalls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inn.yetToBat.length > 0 && (
              <p className="muted yet">
                Yet to bat: {inn.yetToBat.map((id) => playerName(state.config, id)).join(', ')}
              </p>
            )}
          </section>
        )
      })}

      {scorecard.result && (
        <section className="card">
          <h2>Result</h2>
          <p>
            {scorecard.result.kind === 'WINNER'
              ? formatWin(scorecard.result)
              : scorecard.result.kind === 'SUPER_OVER_WINNER'
                ? formatWin(scorecard.result)
                : scorecard.result.kind === 'TIE'
                  ? 'Match tied'
                  : `Match abandoned${scorecard.result.reason ? `: ${scorecard.result.reason}` : ''}`}
          </p>
        </section>
      )}

      {commentary && commentary.length > 0 && (
        <section className="card">
          <h2>Commentary</h2>
          <ol className="commentary-list">
            {commentary
              .slice()
              .reverse()
              .map((line, index) => (
                <li key={`${line.kind}-${line.seq}-${index}`} className={`commentary-line ${line.kind.toLowerCase()}`}>
                  {line.text}
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  )
}