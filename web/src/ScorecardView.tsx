import { Fragment, useState } from 'react'
import type {
  BatterBall,
  CommentaryLine,
  InningsCard,
  MatchEvent,
  MatchState,
  Scorecard,
} from '@cricket-app/core'
import { projectBatterBalls } from '@cricket-app/core'
import { formatWin, playerName } from './scoring'

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
  return (
    <table className="card-table scorecard-table">
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
          const dismissalText = b.out
            ? (b.dismissal ? b.dismissal.replace(/_/g, ' ') : 'out')
            : 'not out'
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
  )
}

export function ScorecardView({ bundle, commentary, events }: Props) {
  const { state, scorecard } = bundle
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  const onToggle = (key: string) => setExpanded((prev) => toggleRowKey(prev, key))

  if (scorecard.innings.length === 0) {
    return (
      <section className="card">
        <p className="muted">No innings yet - record the toss to start.</p>
      </section>
    )
  }

  return (
    <div className="scorecards">
      {scorecard.innings.map((inn) => (
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
            <span>{inn.extras}</span>
          </div>
          <div className="total-row">
            <span>Total</span>
            <span>
              {inn.runs}/{inn.wickets} ({inn.oversText} ov)
            </span>
          </div>

          <h3 className="section-title">Bowling</h3>
          <table className="card-table scorecard-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th className="num">O</th>
                <th className="num">M</th>
                <th className="num">R</th>
                <th className="num">W</th>
                <th className="num">Econ</th>
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
                  <td className="num">0</td>
                  <td className="num">{b.runs}</td>
                  <td className="num">{b.wickets}</td>
                  <td className="num">{b.economy.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {inn.yetToBat.length > 0 && (
            <p className="muted yet">
              Yet to bat: {inn.yetToBat.map((id) => playerName(state.config, id)).join(', ')}
            </p>
          )}
        </section>
      ))}

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