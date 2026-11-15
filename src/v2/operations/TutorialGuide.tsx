import { useEffect, useRef } from 'react'
import { partDefinition } from '../assembly/catalog.ts'
import type { Forecast } from '../planning/forecast.ts'
import type { MissionTelemetry } from './run.ts'
import type { TutorialPart } from './tutorial.ts'
import { nextOpportunity, tutorialParts, tutorialStages, tutorialStage } from './tutorial.ts'

const parts = {
  imager: { label: 'Optical instrument', explanation: 'The camera records red and near-infrared light. Those bands help distinguish vegetation and compare crop conditions between scenes.' },
  solar: { label: 'Solar panel', explanation: 'The solar cells supply electrical power in sunlight. The flight model applies a fixed derating and does not simulate deployment.' },
  battery: { label: 'Battery', explanation: 'The battery stores energy for darkness and for activities that need more power than the solar panel supplies.' },
  radio: { label: 'Radio and antenna', explanation: 'The radio sends stored data through the antenna. The ground station must be in view for a modeled transmission.' },
}

interface GuideProps {
  data: MissionTelemetry
  started: boolean
  inspected: readonly TutorialPart[]
  forecast: Forecast
  inspect: (part: TutorialPart) => void
  start: () => void
  advance: (time: number) => void
  armImaging: () => void
  armRadio: () => void
  retry: () => void
  clock: (time: number) => string
}

export function TutorialGuide({ data, started, inspected, forecast, inspect, start, advance, armImaging, armRadio, retry, clock }: GuideProps) {
  const stage = tutorialStage(started, inspected, data)
  const priorStage = useRef(stage)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (priorStage.current !== stage) {
      priorStage.current = stage
      if (!data.complete) heading.current?.focus({ preventScroll: true })
    }
  }, [stage, data.complete])
  const target = nextOpportunity(forecast.accesses, data.elapsedS)
  const contact = nextOpportunity(forecast.contacts, data.elapsedS)
  const lastPart = inspected.at(-1)
  return <section className="hq-panel tutorial-guide" aria-labelledby="guide-heading">
    <ol className="mission-progress" aria-label="Tutorial progress">
      {tutorialStages.map((name, index) => <li key={name} aria-current={stage === index ? 'step' : undefined}
        className={index < stage || data.complete ? 'reached' : undefined}><span>{index + 1}</span> {name}</li>)}
    </ol>
    <h2 id="guide-heading" ref={heading} tabIndex={-1}>{[
      'Briefing · Monitor Sacramento Valley', 'Inspect the spacecraft', 'Find the first imaging opportunity',
      'Acquire a scene', 'Send the scene to the ground', 'Review the mission',
    ][stage]}</h2>
    {stage === 0 && <>
      <p>Sacramento Valley is our example agricultural region. By observing the same area more than once, a mission can compare how vegetation appears over time. Your goal is to deliver {data.goal} complete simulated scenes.</p>
      <button className="hq-primary" onClick={start}>Start tutorial</button>
    </>}
    {stage === 1 && <>
      <p>Select each subsystem to learn its job before you operate the spacecraft.</p>
      <div className="ops-actions">{tutorialParts.map(part => <button key={part} type="button" aria-pressed={inspected.includes(part)}
        onClick={() => inspect(part)}>{parts[part].label}{inspected.includes(part) && ' ✓'}</button>)}</div>
      {lastPart && <p className="tutorial-callout"><strong>{partDefinition(lastPart).name}</strong> · {parts[lastPart].explanation}</p>}
    </>}
    {stage === 2 && <>
      {lastPart && <p className="tutorial-callout"><strong>{partDefinition(lastPart).name}</strong> · {parts[lastPart].explanation}</p>}
      <p>The ground track is the point directly beneath the spacecraft as it moves. A pass counts as an imaging opportunity only when viewing angle, lighting, and image detail meet the science requirements.</p>
      {target ? <><p>Expected opportunity at <strong>T+{clock(target.startS)}</strong> for {target.endS - target.startS} seconds. Advance to its opening with both systems in standby.</p>
        <button className="ops-execute" onClick={() => advance(target.startS)}>Advance to imaging opportunity</button></> :
        <p className="hq-warn">No imaging opportunity remains. Restart the tutorial to try another run.</p>}
    </>}
    {stage === 3 && <>
      <p>Arming tells the camera to capture automatically when it has an eligible view, power, and storage. Advance one five-second step to see what it captures.</p>
      {!data.imaging ? <button className="ops-execute" onClick={armImaging}>Arm imaging</button> : <>
        <p className="ops-mode active">Imaging armed</p>
        <button className="ops-execute" disabled={!target} aria-describedby={!target ? 'tutorial-imaging-disabled' : undefined}
          onClick={() => target && advance(Math.max(target.startS, data.elapsedS) + forecast.stepS)}>Step 5 s at imaging opportunity</button>
      </>}
      {data.imaging && !target && <p id="tutorial-imaging-disabled" className="hq-warn">No further opportunities remain. Restart to try again.</p>}
    </>}
    {stage === 4 && <>
      <p>A scene is stored onboard. Downlink means sending it to Earth. A contact starts when the spacecraft rises above the ground station’s minimum viewing angle. The simulation uses an illustrative radio rate.</p>
      {!data.radio ? <button className="ops-execute" onClick={armRadio}>Arm downlink</button> : <>
        <p className="ops-mode active">Downlink armed</p>
        {contact && data.elapsedS < contact.startS ? <button className="ops-execute" onClick={() => advance(contact.startS)}>Advance to ground contact · T+{clock(contact.startS)}</button> :
          contact ? <button className="ops-execute" onClick={() => advance(contact.endS)}>Simulate this contact</button> :
            <p className="hq-warn">No contact remains. Restart to try again.</p>}
      </>}
      <p className="tutorial-callout">{data.resources.captured} acquired · {data.resources.delivered} delivered · {(data.resources.deliveredBits / 8e6).toFixed(2)} MB received</p>
    </>}
    {stage === 5 && (data.complete ? <>
      <p>Acquired means the camera recorded a scene. Delivered means the ground received the complete file. This flight delivered <strong>{data.resources.delivered} of {data.goal}</strong> required scenes.</p>
      <div className="ops-actions"><a href="#review-heading">Read science review</a><a href="?mode=headquarters&next=earth">Create or open an agency</a><a href="?">Explore independent missions</a></div>
    </> : <p>The ground has received a complete scene. The camera and radio will stay armed for the remaining passes. Use <strong>Finish mission</strong> below to simulate those passes and see whether the mission met its full goal.</p>)}
    {started && <button className="tutorial-retry" onClick={retry}>Restart tutorial</button>}
  </section>
}
