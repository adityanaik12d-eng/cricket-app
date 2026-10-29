import type { MatchConfig, MatchResult, InningsCard, Scorecard } from '@cricket-app/core'
import { formatWin, playerName, topBowler, topScorer } from './scoring'
import { HomeIcon } from './ui/HomeIcon'

interface Props {
  config: MatchConfig
  scorecard: Scorecard
  result: MatchResult
  onHome: () => void
}

/** Full-screen match result view shown when match is completed. */
export function MatchResultScreen({ config, scorecard, result, onHome }: Props) {

  if (!result) return null

  const isWinner = result.kind === 'WINNER' || result.kind === 'SUPER_OVER_WINNER'
  const winnerTeamId = isWinner ? result.teamId : null
  const loserTeamId = winnerTeamId === config.teamAId ? config.teamBId : config.teamAId

  const winnerInnings = scorecard.innings.find((inn) => inn.battingTeamId === winnerTeamId && inn.closed)
  const loserInnings = scorecard.innings.find((inn) => inn.battingTeamId === loserTeamId && inn.closed)

  return (
    <div className="result-screen">
      <header className="result-header">
        <div className="result-badge">
          {result.kind === 'SUPER_OVER_WINNER' ? 'Superover' : 'Match'}
          {' '}Complete
        </div>
        <h1 className="result-headline">
          {isWinner
            ? formatWin(result as { kind: 'WINNER' | 'SUPER_OVER_WINNER'; teamId: string; by: 'RUNS' | 'WICKETS'; amount: number })
            : result.kind === 'TIE'
              ? 'Match Tied'
              : `Match Abandoned${result.reason ? `: ${result.reason}` : ''}`}
        </h1>
      </header>

      <main className="result-main">
        {isWinner && winnerInnings && loserInnings && (
          <div className="result-innings-comparison">
            <div className="result-innings winner">
              <div className="result-team-name">{winnerInnings.battingTeamId}</div>
              <div className="result-score">{winnerInnings.runs}-{winnerInnings.wickets}</div>
              <div className="result-overs">({winnerInnings.oversText} ov) · RR {winnerInnings.runRate.toFixed(2)}</div>
            </div>
            <div className="result-vs">vs</div>
            <div className="result-innings loser">
              <div className="result-team-name">{loserInnings.battingTeamId}</div>
              <div className="result-score">{loserInnings.runs}-{loserInnings.wickets}</div>
              <div className="result-overs">({loserInnings.oversText} ov) · RR {loserInnings.runRate.toFixed(2)}</div>
            </div>
          </div>
        )}

        {result.kind === 'TIE' && scorecard.innings.length >= 2 && (
          <div className="result-innings-comparison tie">
            {scorecard.innings.map((inn) => (
              <div key={inn.index} className="result-innings">
                <div className="result-team-name">{inn.battingTeamId}</div>
                <div className="result-score">{inn.runs}-{inn.wickets}</div>
                <div className="result-overs">({inn.oversText} ov) · RR {inn.runRate.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        <section className="card result-details">
          {scorecard.innings.map((inn) => (
            <div key={inn.index} className="result-innings-detail">
              <h2>{inn.battingTeamId}</h2>
              <div className="result-innings-summary">
                <span>{inn.runs}-{inn.wickets}</span>
                <span>({inn.oversText} ov)</span>
                <span>RR {inn.runRate.toFixed(2)}</span>
              </div>
              <div className="result-top-performers">
                {(() => {
                  const bat = topScorer(inn)
                  const bowl = topBowler(inn)
                  return (
                    <>
                      {bat && (
                        <div className="performer">
                          <span className="performer-label">Top Score:</span>
                          <span className="performer-value">
                            <strong>{playerName(config, bat.playerId)}</strong> {bat.runs} ({bat.balls}b)
                          </span>
                        </div>
                      )}
                      {bowl && (
                        <div className="performer">
                          <span className="performer-label">Best Bowling:</span>
                          <span className="performer-value">
                            <strong>{playerName(config, bowl.playerId)}</strong> {bowl.wickets}-{bowl.runs} ({bowl.oversText} ov)
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="result-footer">
        <button className="btn accent result-home-btn" onClick={onHome}>
          <HomeIcon size={20} />
          Home
        </button>
      </footer>
    </div>
  )
}