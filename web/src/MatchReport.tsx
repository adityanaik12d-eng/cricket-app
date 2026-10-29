import type { CommentaryLine } from '@cricket-app/core'
import type { MatchBundle } from './match'
import { playerName, requirementText, resultText, topBowler, topScorer } from './scoring'

interface Props {
  bundle: MatchBundle
  commentary: CommentaryLine[]
}

/** The broadcast-style view: headline, both innings at a glance, then the ball-by-ball feed. */
export function MatchReport({ bundle, commentary }: Props) {
  const { state, live, scorecard, result } = bundle
  const headline = resultText(result) ?? requirementText(live)
  const inningsCount = scorecard.innings.length

  // If no innings yet (e.g., match created but toss not done), show a helpful message
  if (inningsCount === 0) {
    return (
      <div className="report">
        <section className="card report-headline">
          <p className="muted">Match created — waiting for toss.</p>
        </section>
        <section className="card">
          <p className="muted">The match will appear here once the toss is recorded and play begins.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="report">
      <section className="card report-headline">
        <p className={headline ? 'result-line' : 'muted'}>
          {headline ?? (live.status === 'SUPER_OVER' ? 'Superover in progress' : 'Match in progress.')}
        </p>
      </section>

      {scorecard.innings.map((inn) => {
        // Defensive: ensure inn has all required fields
        const runs = inn.runs ?? 0
        const wickets = inn.wickets ?? 0
        const oversText = inn.oversText ?? '0'
        const runRate = typeof inn.runRate === 'number' ? inn.runRate : 0

        const bat = topScorer(inn)
        const bowl = topBowler(inn)
        return (
          <section className="card innings-summary" key={inn.index}>
            <header className="innings-head">
              <h2>{inn.battingTeamId ?? `Innings ${inn.index + 1}`}</h2>
              <span className="score">
                {runs}-{wickets}
              </span>
              <span className="muted">
                ({oversText} ov) · RR {runRate.toFixed(2)}
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
                  {bowl.oversText ?? '0'} ov)
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
                <li className={`commentary-line ${(line.kind ?? 'info').toLowerCase()}`} key={line.seq ?? Math.random()}>
                  {line.text}
                </li>
              ))}
          </ol>
        </section>
      )}
      {commentary.length === 0 && inningsCount > 0 && (
        <section className="card">
          <p className="muted">No commentary available yet.</p>
        </section>
      )}
    </div>
  )
}
