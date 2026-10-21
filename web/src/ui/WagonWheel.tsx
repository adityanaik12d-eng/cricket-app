import { useMemo, useState } from 'react'
import {
  WAGON_RUN_FILTERS,
  polarToXY,
  projectWagonWheel,
  summariseWagon,
  wagonRunType,
  type MatchConfig,
  type MatchEvent,
  type WagonShot,
} from '@cricket-app/core'
import { playerName } from '../scoring'

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 26
const GUIDE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** Human label for the delivery, e.g. `4.2`. */
export function wagonBallLabel(shot: WagonShot): string {
  return `${shot.over}.${shot.ball + 1}`
}

/** Accessible description of a single spoke. */
export function wagonShotLabel(config: MatchConfig, shot: WagonShot): string {
  const runs = shot.runs === 1 ? '1 run' : `${shot.runs} runs`
  return `${wagonBallLabel(shot)}, ${playerName(config, shot.batterId)}, ${runs}, ${Math.round(shot.angle)} degrees`
}

/**
 * A hand-drawn wagon wheel: one spoke per recorded shot, positioned by the
 * angle it was hit and how far it travelled, coloured by the runs scored.
 */
export function WagonWheel({ config, events }: { config: MatchConfig; events: MatchEvent[] }) {
  const [batterId, setBatterId] = useState('')
  const [runs, setRuns] = useState<number[]>([])

  const allShots = useMemo(() => projectWagonWheel(events), [events])
  const shots = useMemo(
    () =>
      projectWagonWheel(events, {
        ...(batterId ? { batterId } : {}),
        ...(runs.length > 0 ? { runs } : {}),
      }),
    [events, batterId, runs],
  )
  const summary = summariseWagon(shots)

  const batters = useMemo(() => {
    const ids = [...new Set(allShots.map((shot) => shot.batterId))]
    return ids.map((id) => ({ id, name: playerName(config, id) }))
  }, [allShots, config])

  function toggleRun(value: number): void {
    setRuns((current) => (current.includes(value) ? current.filter((r) => r !== value) : [...current, value]))
  }

  const label = `Wagon wheel: ${summary.shots} shots, ${summary.runs} runs, ${summary.fours} fours, ${summary.sixes} sixes`

  return (
    <section className="card wheel" aria-label="Wagon wheel">
      <h2>Wagon wheel</h2>

      <div className="wheel-filters">
        <label>
          Batter
          <select value={batterId} onChange={(e) => setBatterId(e.target.value)}>
            <option value="">All batters</option>
            {batters.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="wheel-run-filters" role="group" aria-label="Filter by runs">
          {WAGON_RUN_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              className={`chip ${runs.includes(r) ? 'active' : ''}`}
              aria-pressed={runs.includes(r)}
              onClick={() => toggleRun(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {allShots.length === 0 ? (
        <p className="muted wheel-empty">
          No shot placement recorded yet. Turn on “Record placement” while scoring to plot shots on the wheel.
        </p>
      ) : shots.length === 0 ? (
        <p className="muted wheel-empty">No shots match the current filters.</p>
      ) : (
        <svg className="wheel-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} className="wheel-ground" />
          {GUIDE_ANGLES.map((a) => {
            const p = polarToXY(a, 1, RADIUS)
            return (
              <line
                key={a}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + p.x}
                y2={CENTER + p.y}
                className="wheel-guide"
              />
            )
          })}
          <circle cx={CENTER} cy={CENTER} r={5} className="wheel-batter" />
          {shots.map((shot) => {
            const p = polarToXY(shot.angle, shot.distance, RADIUS)
            return (
              <g key={shot.seq} className={`wheel-shot wheel-shot-${wagonRunType(shot.runs)}`}>
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={CENTER + p.x}
                  y2={CENTER + p.y}
                  className="wheel-spoke"
                />
                <circle cx={CENTER + p.x} cy={CENTER + p.y} r={6} className="wheel-dot">
                  <title>{wagonShotLabel(config, shot)}</title>
                </circle>
              </g>
            )
          })}
        </svg>
      )}

      <div className="wheel-legend">
        <span className="wheel-key wheel-shot-runs">Runs</span>
        <span className="wheel-key wheel-shot-four">Four</span>
        <span className="wheel-key wheel-shot-six">Six</span>
        <span className="muted">
          {summary.shots} shots · {summary.runs} runs · {summary.fours} fours · {summary.sixes} sixes
        </span>
      </div>

      <ul className="visually-hidden">
        {shots.map((shot) => (
          <li key={shot.seq}>{wagonShotLabel(config, shot)}</li>
        ))}
      </ul>
    </section>
  )
}
