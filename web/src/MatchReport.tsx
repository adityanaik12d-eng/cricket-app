import type { CommentaryLine } from '@cricket-app/core'
import type { MatchBundle } from './match'
import { playerName, requirementText, resultText, topBowler, topScorer } from './scoring'

interface Props {
  bundle: MatchBundle
  commentary: CommentaryLine[]
}

/** The broadcast-style view: headline, both innings at a glance, then the ball-by-ball feed. */
export function MatchReport({ bundle, commentary }: Props) {
  const { state, live, scorecard } = bundle
  const headline = resultText(bundle.result) ?? requirementText(live)

  return (
    <div className="report">
      <section className="card report-headline">
        <p className={headline ? 'result-line' : 'muted'}>{headline ?? 'Match in progress.'}</p>
      </section>

      {scorecard.innings.map((inn) => {
        const bat = topScorer(inn)
        const bowl = topBowler(inn)
        return (
          <section className="card innings-summary" key={inn.index}>
            <header className="innings-head">
              <h2>{inn.battingTeamId}</h2>
              <span className="score">
                {inn.runs}-{inn.wickets}
              </span>
              <span className="muted">
                ({inn.oversText} ov) · RR {inn.runRate.toFixed(2)}
              </span>
            </header>
            <ul className="report-list">
              {bat && (
                <li>
                  Top score: <strong>{playerName(state.config, bat.playerId)}</strong> {bat.runs} ({bat.balls}b)
                </li>
              )}
              {bowl && (
                <li>
                  Best bowling: <strong>{playerName(state.config, bowl.playerId)}</strong> {bowl.wickets}-{bowl.runs} (
                  {bowl.oversText} ov)
                </li>
              )}
            </ul>
          </section>
        )
      })}

      {commentary.length > 0 && (
        <section className="card">
          <h2>Commentary</h2>
          <ol className="commentary-list">
            {commentary
              .slice()
              .reverse()
              .map((line) => (
                <li className={`commentary-line ${line.kind.toLowerCase()}`} key={line.seq}>
                  {line.text}
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  )
}
