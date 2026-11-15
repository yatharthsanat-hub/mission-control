import { Component, lazy, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createFlightModel } from '../planning/flightModel.ts'
import { inertialToFixed, siteUnit } from '../planning/geometry.ts'
import type { Vector } from '../planning/geometry.ts'
import type { ForecastMission } from '../planning/mission.ts'
import type { MissionTelemetry } from './run.ts'

const Globe = lazy(() => import('./Globe.tsx'))
const rad = Math.PI / 180
const xy = ([x, y, z]: Vector): readonly [number, number] =>
  [180 + Math.atan2(y, x) / rad, 90 - Math.atan2(z, Math.hypot(x, y)) / rad]

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

export function OrbitView({ mission, telemetry }: { mission: ForecastMission; telemetry: MissionTelemetry }) {
  const [hasWebgl] = useState(webglAvailable)
  const [globe, setGlobe] = useState(hasWebgl)
  const env = mission.environment
  const paths = useMemo(() => {
    const model = createFlightModel(mission, mission.analysisProfile)
    const period = mission.orbit.initialState.periodS
    const fixed: Vector[] = []
    for (let time = 0; time <= mission.analysisProfile.durationS; time += 180) fixed.push(model.at(time).fixed)
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
  }, [mission])
  const orbit = useMemo(() => globe ? paths.inertial.map(position => {
    const fixed = inertialToFixed(position, telemetry.elapsedS, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
    return [fixed[0] / env.earthRadiusM, fixed[1] / env.earthRadiusM, fixed[2] / env.earthRadiusM] as Vector
  }) : [], [globe, paths.inertial, env, telemetry.elapsedS])
  const craft = telemetry.orbital.fixed.map(value => value / env.earthRadiusM) as unknown as Vector
  const target = siteUnit(mission.target)
  const station = siteUnit(env.groundStation)
  const sun = inertialToFixed(env.sunDirectionInertial, telemetry.elapsedS, env.siderealDayS, env.primeMeridianAngleAtEpochRad)
  const marker = (value: Vector, label: string, color: string) => {
    const [x, y] = xy(value)
    return <circle cx={x} cy={y} r="2" fill={color}><title>{label}</title></circle>
  }
  const fallback = <svg className="ops-map" viewBox="0 0 360 180" role="img" aria-label="Earth-fixed map of the spacecraft ground track, science target and ground station">
    <rect width="360" height="180" fill="#101f30" />
    {[30, 60, 90, 120, 150].map(y => <path key={y} d={`M0,${y} H360`} stroke="#395467" strokeWidth=".45" />)}
    {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(x => <path key={x} d={`M${x},0 V180`} stroke="#395467" strokeWidth=".45" />)}
    {paths.map.map((points, index) => <polyline key={index} points={points.join(' ')} fill="none" stroke="#5cbdcb" strokeWidth=".7" />)}
    {marker(target, mission.target.label, '#ffce89')}
    {marker(station, env.groundStation.id, '#79adff')}
    {marker(telemetry.orbital.fixed, 'Spacecraft subpoint', '#effff7')}
  </svg>
  return <section className="hq-panel ops-orbit" aria-labelledby="orbit-view-heading">
    <div className="ops-panel-head"><div><h2 id="orbit-view-heading">Orbital situation</h2><p>Synthetic Earth-fixed view · {mission.target.label}</p></div>
      {hasWebgl && <button onClick={() => setGlobe(value => !value)}>{globe ? 'Use 2D map' : 'Use 3D globe'}</button>}</div>
    <div className="ops-canvas">
      {globe ? <GlobeBoundary fallback={fallback}>
        <Suspense fallback={fallback}><Globe orbit={orbit} track={paths.surface} craft={craft} target={target} station={station} sun={sun}
          access={!telemetry.complete && telemetry.upcoming.access.available}
          contact={!telemetry.complete && telemetry.upcoming.station.inContact} onLost={() => setGlobe(false)} /></Suspense>
      </GlobeBoundary> : fallback}
    </div>
    <ul className="ops-legend">
      <li className="craft">Spacecraft</li><li className="ground">Ground track</li>
      {globe && <li className="orbit">Osculating orbit</li>}
      <li className="target">Target</li><li className="station">Ground station</li>
    </ul>
    <p className="hq-small">{globe ? 'Drag to orbit, scroll or pinch to zoom, and right-drag or two-finger drag to pan.' : 'Map grid uses longitude and latitude. Select 3D when WebGL is available.'}</p>
  </section>
}
