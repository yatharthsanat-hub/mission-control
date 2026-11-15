import type { Vector } from '../planning/geometry.ts'
import type { Interval } from '../planning/forecast.ts'
import type { ExecutableMission } from '../planning/mission.ts'
import type { MissionTelemetry } from './run.ts'

const degrees = 180 / Math.PI
const width = 360
const height = 200
const lonSpan = 15
const latSpan = 9
const wrap = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180
const longitude = ([x, y]: Vector) => Math.atan2(y, x) * degrees
const latitude = ([x, y, z]: Vector) => Math.atan2(z, Math.hypot(x, y)) * degrees
const coord = (value: number, negative: string, positive: string) => `${Math.abs(value).toFixed(1)}°${value < 0 ? negative : positive}`

export function TargetChart({ mission, telemetry, opportunity, approach, eligible, station }: {
  mission: ExecutableMission; telemetry: MissionTelemetry; opportunity?: Interval
  approach: readonly Vector[]; eligible: readonly Vector[]; station: Vector | null
}) {
  const { target } = mission
  const centerLat = Math.min(90 - latSpan, Math.max(latSpan - 90, target.latitudeDeg))
  const project = (lon: number, lat: number) => [
    width / 2 * (1 + wrap(lon - target.longitudeDeg) / lonSpan),
    height / 2 * (1 - (lat - centerLat) / latSpan),
  ] as const
  const point = (fixed: Vector) => project(longitude(fixed), latitude(fixed))
  const points = (track: readonly Vector[]) => track.map(fixed => point(fixed).map(n => n.toFixed(2)).join(',')).join(' ')
  const [tx, ty] = project(target.longitudeDeg, target.latitudeDeg)
  const [cx, cy] = point(telemetry.orbital.fixed)
  const visible = (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height
  const terminal = station && point(station)
  const open = !telemetry.complete && telemetry.upcoming.access.available
  return <>
    <svg className="ops-map ops-target-chart" viewBox="0 0 360 200" role="img"
      aria-label={`Earth-fixed geographic grid around ${target.label}, with the projected ground track and eligible viewing segment`}>
      <rect width={width} height={height} fill="#101d30" />
      {[-.66, -.33, 0, .33, .66].map(offset => {
        const x = width / 2 * (1 + offset)
        return <g key={offset}><path d={`M${x} 0V${height}`} stroke="#334962" strokeWidth=".7" />
          <text x={x + 3} y={height - 6}>{coord(wrap(target.longitudeDeg + lonSpan * offset), 'W', 'E')}</text></g>
      })}
      {[-.65, -.32, .32, .65].map(offset => {
        const y = height / 2 * (1 + offset)
        return <g key={offset}><path d={`M0 ${y}H${width}`} stroke="#334962" strokeWidth=".7" />
          <text x="4" y={y - 3}>{coord(centerLat - latSpan * offset, 'S', 'N')}</text></g>
      })}
      {approach.length > 1 && <polyline points={points(approach)} fill="none" stroke="#7ad0df" strokeWidth="1.65" />}
      {eligible.length > 1 && <polyline points={points(eligible)} fill="none" stroke="#ffce89" strokeWidth="3" />}
      {open && visible(cx, cy) && <path d={`M${cx} ${cy}L${tx} ${ty}`} stroke="#ffce89" strokeDasharray="3 4" />}
      <circle cx={tx} cy={ty} r="4" fill="#ffce89" stroke="#101827" />
      <text className="target-label" x={tx + 8} y={ty - 6}>{target.label}</text>
      {terminal && visible(...terminal) && <rect x={terminal[0] - 2.5} y={terminal[1] - 2.5} width="5" height="5" fill="#91adfd"><title>Scenario ground station</title></rect>}
      {visible(cx, cy) && <circle cx={cx} cy={cy} r="3" fill="#e7edf3" stroke="#101827"><title>Current point directly below the spacecraft</title></circle>}
      <text x={width - 13} y="14">N ↑</text>
    </svg>
    <div className="ops-target-caption">
      <strong>{telemetry.complete ? 'Flight complete' : open ? 'Imaging opportunity open' : opportunity ? 'Waiting for the next imaging opportunity' : 'No imaging opportunities remain'}</strong>
      <p>{coord(target.latitudeDeg, 'S', 'N')} · {coord(target.longitudeDeg, 'W', 'E')}. {visible(cx, cy) ? 'The white dot marks the current point below the spacecraft.' : 'The spacecraft’s current ground position is outside this regional view.'}</p>
      <p>Geographic grid with modeled tracks. Amber marks the portion of the illustrated pass that meets viewing requirements.</p>
    </div>
  </>
}
