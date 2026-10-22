import { useMemo } from 'react'
import {
  BEEHIVE_RADIUS,
  beehiveLattice,
  beehiveTone,
  hexCenter,
  projectBeehive,
  type BeehiveCell,
  type MatchEvent,
} from '@cricket-app/core'

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 24

/** The six corners of a pointy-top hexagon. */
function hexPolygon(size: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const x = size * Math.cos(angle)
    const y = size * Math.sin(angle)
    points.push(`${x.toFixed(3)},${y.toFixed(3)}`)
  }
  return points.join(' ')
}

function cellKey(cell: { col: number; row: number }): string {
  return `${cell.col}:${cell.row}`
}

function cellLabel(cell: BeehiveCell): string {
  const ballText = cell.balls === 1 ? '1 ball' : `${cell.balls} balls`
  const runText = cell.runs === 1 ? '1 run' : `${cell.runs} runs`
  return `${cellLabelShort(cell)} · ${ballText} · ${runText}`
}

function cellLabelShort(cell: BeehiveCell): string {
  if (cell.sixes > 0 && cell.fours === 0) return cell.sixes === 1 ? '1 six' : `${cell.sixes} sixes`
  if (cell.fours > 0 && cell.sixes === 0) return cell.fours === 1 ? '1 four' : `${cell.fours} fours`
  if (cell.fours > 0 && cell.sixes > 0) return `${cell.fours} fours, ${cell.sixes} sixes`
  return `${cell.runs} runs`
}

/** The beehive: where the scoring concentrated on the ground. */
export function Beehive({ events }: { events: MatchEvent[] }) {
  const cells = useMemo(() => projectBeehive(events), [events])
  const lattice = useMemo(() => beehiveLattice(BEEHIVE_RADIUS), [])
  const map = useMemo(() => new Map(cells.map((cell) => [cellKey(cell), cell])), [cells])

  const totalBalls = cells.reduce((sum, cell) => sum + cell.balls, 0)
  const totalRuns = cells.reduce((sum, cell) => sum + cell.runs, 0)
  const label = `Beehive: ${totalBalls} ball${totalBalls === 1 ? '' : 's'}, ${totalRuns} run${totalRuns === 1 ? '' : 's'}`

  const size = BEEHIVE_RADIUS / 4
  const scale = RADIUS / BEEHIVE_RADIUS

  return (
    <section className="card beehive" aria-label="Beehive">
      <h2>Beehive</h2>

      {cells.length === 0 ? (
        <p className="muted beehive-empty">
          No shot placement recorded yet. Turn on “Record placement” while scoring to see where the runs
          went.
        </p>
      ) : (
        <>
          <svg className="beehive-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
            <g transform={`translate(${CENTER}, ${CENTER}) scale(${scale})`}>
              {lattice.map((coord) => {
                const { x, y } = hexCenter(coord.col, coord.row, BEEHIVE_RADIUS)
                const cell = map.get(cellKey(coord))
                const tone = beehiveTone(cell?.balls ?? 0)
                return (
                  <polygon
                    key={cellKey(coord)}
                    className={`beehive-cell beehive-tone-${tone}`}
                    points={hexPolygon(size)}
                    transform={`translate(${x}, ${y})`}
                  >
                    {cell ? <title>{cellLabel(cell)}</title> : null}
                  </polygon>
                )
              })}
            </g>
          </svg>

          <table className="visually-hidden">
            <thead>
              <tr>
                <th>Column</th>
                <th>Row</th>
                <th>Balls</th>
                <th>Runs</th>
                <th>Fours</th>
                <th>Sixes</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => (
                <tr key={cellKey(cell)}>
                  <td>{cell.col}</td>
                  <td>{cell.row}</td>
                  <td>{cell.balls}</td>
                  <td>{cell.runs}</td>
                  <td>{cell.fours}</td>
                  <td>{cell.sixes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
