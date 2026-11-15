import { Component, lazy, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createFlightModel } from '../planning/flightModel.ts'
import { inertialToFixed, siteUnit } from '../planning/geometry.ts'
import type { Vector } from '../planning/geometry.ts'
import type { ExecutableMission } from '../planning/mission.ts'
import { environmentModel } from '../planning/environments.ts'
import type { MissionTelemetry } from './run.ts'
import type { Interval } from '../planning/forecast.ts'
import { nextOpportunity } from './tutorial.ts'
import { TargetChart } from './TargetChart.tsx'
import { blueMarbleSource, fixedCoordinates } from './geography.ts'

const Globe = lazy(() => import('./Globe.tsx'))
function xy(position: Vector): readonly [number, number] {
  const { longitudeDeg, latitudeDeg } = fixedCoordinates(position)
  return [180 + longitudeDeg, 90 - latitudeDeg]
}

class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function webglAvailable() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch { return false }
}

export function OrbitView({ mission, telemetry, accesses }: { mission: ExecutableMission; telemetry: MissionTelemetry; accesses: readonly Interval[] }) {
  const env = useMemo(() => environmentModel(mission.environment), [mission.environment])
  const lunar = env.body === 'moon'
  const [hasWebgl] = useState(webglAvailable)
  const [globe, setGlobe] = useState(lunar && hasWebgl)
  const model = useMemo(() => createFlightModel(mission, mission.analysisProfile), [mission])
  const opportunity = nextOpportunity(accesses, telemetry.elapsedS)
  const depicted = opportunity ?? accesses.at(-1)
  const regional = useMemo(() => {
    if (lunar || !depicted) return { approach: [], eligible: [] }
    function sample(start: number, end: number, stride: number) {
      const points: Vector[] = []
      for (let time = start; time < end; time += stride) points.push(model.at(time).fixed)
      return [...points, model.at(end).fixed]
    }
    return {
      approach: sample(Math.max(0, depicted.startS - 180), Math.min(mission.analysisProfile.durationS, depicted.endS + 180), 10),
      eligible: sample(depicted.startS, depicted.endS, mission.analysisProfile.stepS),
    }
  }, [depicted, lunar, mission.analysisProfile, model])
  const paths = useMemo(() => {
    const period = mission.orbit.initialState.periodS
    const fixed: Vector[] = []
    if (lunar) for (let time = 0; time <= mission.analysisProfile.durationS; time += 180) fixed.push(model.at(time).fixed)
    const inertial = Array.from({ length: 145 }, (_, i) => model.at(i * period / 144).positionM)
    const surface = fixed.map(position => {
      const r = Math.hypot(...position)
      return [position[0] / r, position[1] / r, position[2] / r] as Vector
    })
    const map: string[][] = []
    fixed.forEach((position, i) => {
      const [x, y] = xy(position)
      if (!i || Math.abs(x - xy(fixed[i - 1])[0]) > 180) map.push([])
      map.at(-1)?.push(`${x.toFixed(2)},${y.toFixed(2)}`)
    })
    return { inertial, surface, map }
  }, [lunar, mission, model])
  const orbit = useMemo(() => globe ? paths.inertial.map(position => {
    const fixed = inertialToFixed(position, telemetry.elapsedS, env.rotationPeriodS, env.primeMeridianAngleAtEpochRad)
    return [fixed[0] / env.radiusM, fixed[1] / env.radiusM, fixed[2] / env.radiusM] as Vector
  }) : [], [globe, paths.inertial, env, telemetry.elapsedS])
  const craft = telemetry.orbital.fixed.map(value => value / env.radiusM) as unknown as Vector
  const target = siteUnit(mission.target)
  const link = env.communications
  const station = link.kind === 'surface-terminal' ? siteUnit(link.station) : null
  const earthDirection = link.kind === 'parallel-earth-service' ? link.earthDirectionFixed : null
  const sun = inertialToFixed(env.sunDirectionInertial, telemetry.elapsedS, env.rotationPeriodS, env.primeMeridianAngleAtEpochRad)
  const acquired = telemetry.observations.at(-1)
  const marker = (value: Vector, label: string, color: string) => {
    const [x, y] = xy(value)
    return <circle cx={x} cy={y} r="2" fill={color}><title>{label}</title></circle>
  }
  const fallback = !lunar ? <TargetChart mission={mission} telemetry={telemetry} opportunity={opportunity} {...regional} station={station} />
    : <svg className="ops-map" viewBox="0 0 360 180" role="img" aria-label="Moon-fixed map of the spacecraft ground track and lunar science target">
    <rect width="360" height="180" fill="#232630" />
    {[30, 60, 90, 120, 150].map(y => <path key={y} d={`M0,${y} H360`} stroke="#395467" strokeWidth=".45" />)}
    {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(x => <path key={x} d={`M${x},0 V180`} stroke="#395467" strokeWidth=".45" />)}
    {paths.map.map((points, index) => <polyline key={index} points={points.join(' ')} fill="none" stroke="#5cbdcb" strokeWidth=".7" />)}
    {marker(target, mission.target.label, acquired && lunar ? '#87d8af' : '#ffce89')}
    {station && marker(station, link.kind === 'surface-terminal' ? link.station.id : 'Terminal', '#79adff')}
    {marker(telemetry.orbital.fixed, 'Spacecraft subpoint', '#effff7')}
  </svg>
  return <section className="hq-panel ops-orbit" aria-labelledby="orbit-view-heading">
    <div className="ops-panel-head"><div><h2 id="orbit-view-heading">{lunar || globe ? 'Orbital situation' : 'Target and ground track'}</h2><p>{env.label}-fixed coordinates · {mission.target.label}</p></div>
      {hasWebgl && <button onClick={() => setGlobe(value => !value)}>{globe ? lunar ? 'Use 2D map' : 'Use target map' : 'Use 3D globe'}</button>}</div>
    <div className={lunar || globe ? 'ops-canvas' : 'ops-chart'}>
      {globe ? <GlobeBoundary fallback={fallback}>
        <Suspense fallback={fallback}><Globe orbit={orbit} track={paths.surface} craft={craft} target={target} station={station} sun={sun}
          lunar={lunar} earthDirection={earthDirection} acquired={lunar && !!acquired}
          access={!telemetry.complete && telemetry.upcoming.access.available}
          contact={!telemetry.complete && telemetry.upcoming.station.inContact} onLost={() => setGlobe(false)} /></Suspense>
      </GlobeBoundary> : fallback}
    </div>
    <ul className="ops-legend">
      <li className="craft">{globe ? 'Spacecraft' : 'Point below spacecraft'}</li>
      {(!globe || lunar) && <li className="ground">Ground track</li>}
      {globe && <li className="orbit">Spacecraft orbit above surface</li>}
      <li className={lunar && acquired ? 'orbit' : 'target'}>{lunar && acquired ? 'Imaged target' : 'Target'}</li>
      {station ? <li className="station">Ground station{!globe && ' (if in view)'}</li> : globe && <li className="station">Assumed Earth direction during contact</li>}
    </ul>
    {lunar && <p className="hq-small">{env.fixedFrame} · {acquired ? `Latest footprint: ${(acquired.acrossM / 1000).toFixed(2)} × ${(acquired.alongM / 1000).toFixed(2)} km (local approximation)` : 'No reconnaissance imagery acquired.'}</p>}
    {globe && <p className="hq-small">Drag to orbit. Scroll or pinch to zoom. The orbit shows the path in space, above the surface.</p>}
    {globe && !lunar && <p className="hq-small"><a href={blueMarbleSource} target="_blank" rel="noreferrer">NASA Earth Observatory · Blue Marble</a> · July 2004 surface basemap.</p>}
  </section>
}
