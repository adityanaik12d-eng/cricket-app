import type { Scorecard, MatchState } from '@cricket-app/core'
import { formatWin, playerName } from './scoring'

interface Props {
  bundle: {
    state: MatchState
    scorecard: Scorecard
  }
}

export function ScorecardView({ bundle }: Props) {
  const { state, scorecard } = bundle
  if (scorecard.innings.length === 0) {
    return (
      <section className="card">
        <p className="muted">No innings yet — record the toss to start.</p>
      </section>
    )
  }

  return (
    <div className="scorecards">
      {scorecard.innings.map((inn) => (
        <section className="card" key={inn.index}>
          <header className="innings-head">
            <h2>
              Innings {inn.index + 1} · {inn.battingTeamId}
            </h2>
            <span className="score">
              {inn.runs}-{inn.wickets}
            </span>
            <span className="muted">
              ({inn.oversText} ov) · RR {inn.runRate.toFixed(2)}
              {inn.declared ? ' · declared' : ''}
              {inn.closed ? ' · closed' : ''}
            </span>
          </header>

          <table className="card-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th className="num">R</th>
                <th className="num">B</th>
                <th className="num">4s</th>
                <th className="num">6s</th>
                <th>Dismissal</th>
              </tr>
            </thead>
            <tbody>
              {inn.batting.map((b) => (
                <tr key={b.playerId}>
                  <td>
                    {playerName(state.config, b.playerId)}
                    {b.isStriker ? ' *' : b.isNonStriker ? ' †' : ''}
                  </td>
                  <td className="num">{b.runs}</td>
                  <td className="num">{b.balls}</td>
                  <td className="num">{b.fours}</td>
                  <td className="num">{b.sixes}</td>
                  <td className="muted">
                    {b.out
                      ? (b.dismissal?.replace('_', ' ') ?? 'out')
                      : 'not out'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="extras">
            Extras {inn.extras} ·{' '}
            <strong>
              Total {inn.runs} ({inn.wickets} {inn.wickets === 1 ? 'wkt' : 'wkts'}, {inn.oversText} ov)
            </strong>
          </p>

          <table className="card-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th className="num">O</th>
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
                    {b.isCurrentBowler ? ' •' : ''}
                  </td>
                  <td className="num">{b.oversText}</td>
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
              : scorecard.result.kind === 'TIE'
                ? 'Match tied'
                : `Match abandoned${scorecard.result.reason ? `: ${scorecard.result.reason}` : ''}`}
          </p>
        </section>
      )}
    </div>
  )
}
