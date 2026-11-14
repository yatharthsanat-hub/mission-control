import { useEffect, useState } from 'react'
import { bus, imagers, missionObjectives, orbitOptions, simulationRules } from '../simulation/catalog.ts'
import type { CompletedMission } from '../simulation/simulate.ts'
import type { StepTelemetry } from '../simulation/types.ts'
import { Icon, OrbitGraphic } from './Visuals.tsx'

const observationNotes = {
  none: '',
  captured: '',
  'storage-full': 'Imaging skipped · storage full',
  reserve: 'Imaging skipped · battery reserve',
  outage: 'Imaging skipped · power outage',
  'downlink-priority': 'Imaging skipped · downlink took priority',
}

function stepMessage(step: StepTelemetry | undefined) {
  if (!step) return 'Ready for orbit 1. Battery fully charged and storage empty.'
  const events: string[] = []
  if (step.activity === 'outage') events.push('Housekeeping power outage')
  if (step.capturedMB) events.push(`Scene captured · ${step.capturedMB} MB stored`)
  if (step.transmittedMB) events.push(`Downlink active · ${step.transmittedMB} MB transmitted`)
  if (step.downlink === 'reserve') events.push('Downlink skipped · battery reserve')
  if (step.downlink === 'outage') events.push('Downlink skipped · power outage')
  if (step.downlink === 'empty') events.push('Ground contact · queue empty')
  const observation = observationNotes[step.observation]
  if (observation) events.push(observation)
  return events.join(' • ') || 'Housekeeping only'
}

export function Operations({ run, finish, edit }: {
  run: CompletedMission
  finish: () => void
  edit: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const { timeline, metrics, completion, configuration } = run
  const ended = cursor === timeline.length
  const step = timeline[cursor - 1]
  const playing = isPlaying && !ended

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setCursor(current => Math.min(timeline.length, current + 1))
    }, 600 / speed)
    return () => window.clearInterval(timer)
  }, [playing, speed, timeline.length])

  const active = timeline.slice(0, cursor)
  const imager = imagers[configuration.imager]
  const capturedScenes = active.reduce((mb, sample) => mb + sample.capturedMB, 0) / imager.sceneMB
  const transmittedMB = active.reduce((mb, sample) => mb + sample.transmittedMB, 0)
  const battery = step?.batteryWattMinutes ?? metrics.batteryCapacityWattMinutes
  const storage = step?.storedMB ?? 0
  const batteryPercent = Math.round(100 * battery / metrics.batteryCapacityWattMinutes)
  const stepsPerOrbit = simulationRules.stepsPerOrbit

  function jumpToOrbitEnd() {
    setIsPlaying(false)
    setCursor(Math.min(timeline.length, (Math.floor(cursor / stepsPerOrbit) + 1) * stepsPerOrbit))
  }

  return (
    <>
      <button className="text-button back-button" onClick={edit}><Icon name="back" /> Back to design</button>
      <div className="page-heading">
        <p className="eyebrow">{missionObjectives[configuration.objective].name}</p>
        <h1>Mission operations.</h1>
        <p>{orbitOptions[configuration.orbit].name} · {simulationRules.stepMinutes} simulated minutes per step</p>
      </div>
      <div className="work-grid operations-grid">
        <div className="panel orbit-panel">
          <div className="orbit-header"><strong>Orbit {step?.orbit ?? 1} / {simulationRules.orbitCount}</strong>
            <span className={step && !step.sunlit ? 'tag eclipse' : 'tag'}>{step ? (step.sunlit ? 'Sunlight' : 'Eclipse') : 'Awaiting playback'}</span>
          </div>
          <OrbitGraphic step={step} />
          <div className="orbit-caption">
            <span>Schematic orbit · {step ? `Step ${step.step + 1} / ${stepsPerOrbit}` : 'Start of mission'}</span>
            <span>{step?.inContact ? 'Ground station in contact' : 'Ground station out of contact'}</span>
          </div>
        </div>
        <aside className="panel telemetry" aria-labelledby="telemetry-title">
          <h2 id="telemetry-title">Flight telemetry</h2>
          <p className={step?.activity === 'outage' ? 'flight-event danger' : 'flight-event'} aria-live={playing ? 'off' : 'polite'}>
            {stepMessage(step)}
          </p>
          <div className="limit-list">
            <div className="limit">
              <div><span>Battery charge</span><strong>{batteryPercent}%</strong></div>
              <meter aria-label="Battery charge" aria-valuetext={`${batteryPercent}%`} value={battery} max={metrics.batteryCapacityWattMinutes} />
              <small className="muted">{(battery / 60).toFixed(2)} Wh{step ? ` · ${step.solarWatts} W solar output` : ''}</small>
            </div>
            <div className="limit">
              <div><span>Onboard storage</span><strong>{storage} / {bus.storageMB} MB</strong></div>
              <meter aria-label="Onboard storage" value={storage} max={bus.storageMB} />
            </div>
          </div>
          <dl className="telemetry-list">
            <div><dt>Scenes captured</dt><dd>{capturedScenes}</dd></div>
            <div><dt>Complete scenes delivered</dt><dd>{step?.deliveredScenes ?? 0} / {completion.targetScenes}</dd></div>
            <div><dt>Data transmitted</dt><dd>{transmittedMB} MB</dd></div>
          </dl>
        </aside>
      </div>
      <section className="panel playback-panel" aria-labelledby="playback-title">
        <div className="playback-heading"><h2 id="playback-title">Mission timeline</h2><span>{ended ? 'Playback complete' : `${cursor} / ${timeline.length} steps`}</span></div>
        <div className="orbit-track" aria-hidden="true">
          {Array.from({ length: simulationRules.orbitCount }, (_, orbit) => (
            <div key={orbit}>
              <div className="track-cells">{timeline.slice(orbit * stepsPerOrbit, (orbit + 1) * stepsPerOrbit).map((sample, index) => (
                <span key={index} className={orbit * stepsPerOrbit + index < cursor ? `track-${sample.activity}` : ''} />
              ))}</div>
              <span>Orbit {orbit + 1}</span>
            </div>
          ))}
        </div>
        <div className="track-legend">
          <span><i className="track-idle" /> Housekeeping</span>
          <span><i className="track-capture" /> Imaging</span>
          <span><i className="track-downlink" /> Downlink</span>
          <span><i className="track-outage" /> Outage</span>
        </div>
        <div className="playback-controls">
          <button className="button secondary" onClick={() => setIsPlaying(!playing)} disabled={ended}>
            <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play'}
          </button>
          <button className="button secondary" onClick={() => { setIsPlaying(false); setCursor(0) }} disabled={cursor === 0 && !playing}>
            <Icon name="restart" /> Restart
          </button>
          <button className="button secondary" disabled={ended} onClick={() => { setIsPlaying(false); setCursor(cursor + 1) }}>Next step</button>
          <button className="button secondary" disabled={ended} onClick={jumpToOrbitEnd}>Finish orbit</button>
          <label className="speed-control">Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
            <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option><option value={8}>8×</option>
          </select></label>
          <button className="button primary results-button" onClick={finish}>{ended ? 'View Results' : 'Finish & View Results'} <Icon name="arrow" /></button>
        </div>
      </section>
    </>
  )
}
