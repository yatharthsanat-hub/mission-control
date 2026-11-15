import type { Vector } from '../planning/geometry.ts'
import type { Interval } from '../planning/forecast.ts'
import type { ExecutableMission } from '../planning/mission.ts'
import type { MissionTelemetry } from './run.ts'
import { blueMarbleSource, chartPoint, fixedCoordinates, mapHeight as height, mapWidth as width, regionalBasemaps } from './geography.ts'

const coord = (value: number, negative: string, positive: string) => `${Math.abs(value).toFixed(1)}°${value < 0 ? negative : positive}`

export function TargetChart({ mission, telemetry, opportunity, approach, eligible, station }: {
  mission: ExecutableMission; telemetry: MissionTelemetry; opportunity?: Interval
  approach: readonly Vector[]; eligible: readonly Vector[]; station: Vector | null
}) {
  const { target } = mission
  const bounds = target.longitudeDeg <= -110 ? regionalBasemaps.west : regionalBasemaps.gulf
  const point = (fixed: Vector) => chartPoint(fixedCoordinates(fixed), bounds)
  const points = (track: readonly Vector[]) => track.map(fixed => point(fixed).map(n => n.toFixed(2)).join(',')).join(' ')
  const [tx, ty] = chartPoint(target, bounds)
  const [cx, cy] = point(telemetry.orbital.fixed)
  const visible = (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height
  const terminal = station && point(station)
  const open = !telemetry.complete && telemetry.upcoming.access.available
  return <>
    <svg className="ops-map ops-target-chart" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Earth-fixed map of ${target.label}, with the projected ground track and eligible viewing segment`}>
      <rect width={width} height={height} fill="var(--surface)" />
      <image href={`${import.meta.env.BASE_URL}mission/${bounds.file}`} width={width} height={height} />
      <rect width={width} height={height} fill="var(--bg)" opacity=".28" />
      {[.25, .5, .75].map(fraction => {
        const x = width * fraction
        return <g key={fraction}><path d={`M${x} 0V${height}`} stroke="var(--ink)" strokeOpacity=".38" strokeWidth=".55" />
          <text x={x + 3} y={height - 6}>{coord(bounds.west + (bounds.east - bounds.west) * fraction, 'W', 'E')}</text></g>
      })}
      {[.25, .5, .75].map(fraction => {
        const y = height * fraction
        return <g key={fraction}><path d={`M0 ${y}H${width}`} stroke="var(--ink)" strokeOpacity=".38" strokeWidth=".55" />
          <text x="4" y={y - 3}>{coord(bounds.north - (bounds.north - bounds.south) * fraction, 'S', 'N')}</text></g>
      })}
      {approach.length > 1 && <polyline points={points(approach)} fill="none" stroke="var(--telemetry)" strokeWidth="1.65" />}
      {eligible.length > 1 && <polyline points={points(eligible)} fill="none" stroke="var(--amber)" strokeWidth="3" />}
      {open && visible(cx, cy) && <path d={`M${cx} ${cy}L${tx} ${ty}`} stroke="var(--amber)" strokeDasharray="3 4" />}
      <circle className="target-marker" cx={tx} cy={ty} r="4" fill="var(--amber)" stroke="var(--bg)" />
      <text className="target-label" x={tx + 8} y={ty - 6}>{target.label}</text>
      {terminal && visible(...terminal) && <rect x={terminal[0] - 2.5} y={terminal[1] - 2.5} width="5" height="5" fill="var(--accent)"><title>Illustrative New Mexico training terminal</title></rect>}
      {visible(cx, cy) && <circle cx={cx} cy={cy} r="3" fill="var(--ink)" stroke="var(--bg)"><title>Current point directly below the spacecraft</title></circle>}
      <text x={width - 13} y="14">N ↑</text>
    </svg>
    <div className="ops-target-caption">
      <strong>{telemetry.complete ? 'Flight complete' : open ? 'Imaging opportunity open' : opportunity ? 'Waiting for the next imaging opportunity' : 'No imaging opportunities remain'}</strong>
      <p><span className="ops-coordinate">{coord(target.latitudeDeg, 'S', 'N')} · {coord(target.longitudeDeg, 'W', 'E')}</span>. {visible(cx, cy) ? 'The white dot marks the current point below the spacecraft.' : 'The spacecraft’s current ground position is outside this regional view.'}</p>
      <p>Amber marks the portion of the pass that meets modeled viewing requirements. <a href={blueMarbleSource} target="_blank" rel="noreferrer">NASA Earth Observatory · Blue Marble</a> · July 2004 basemap, separate from simulated observations.</p>
    </div>
  </>
}
