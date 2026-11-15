import { useEffect, useMemo, useRef, useState } from 'react'
import { applyCommand } from '../agency.ts'
import { readLocal, writeLocal } from '../localSaves.ts'
import { decodeSave } from '../saveFormat.ts'
import type { Save } from '../saveFormat.ts'
import { approvalContext, approveMission, defaultPlan, launches, maxApprovedMissions, missionSources, objectives, review, targets } from './mission.ts'
import type { MissionConfiguration, Plan } from './mission.ts'
import { groundTrack } from './orbit.ts'
import type { OrbitInput } from './orbit.ts'
import '../headquarters.css'
import './planner.css'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd = (cents: number) => money.format(cents / 100)
const fields: readonly [keyof OrbitInput, string][] = [
  ['altitudeKm', 'Semi-major axis above sphere (km)'], ['eccentricity', 'Eccentricity'],
  ['inclinationDeg', 'Inclination (°)'], ['nodeDeg', 'Ascending node (°)'],
  ['periapsisDeg', 'Argument of periapsis (°)'], ['meanAnomalyDeg', 'Initial mean anomaly (°)'],
]

function Preview({ orbit, target }: Pick<ReturnType<typeof review>, 'orbit' | 'target'>) {
  const track = useMemo(() => orbit ? groundTrack(orbit.elements) : [], [orbit])
  const lines: string[][] = []
  track.forEach((point, index) => {
    if (!index || Math.abs(point.longitudeDeg - track[index - 1].longitudeDeg) > 180) lines.push([])
    lines.at(-1)?.push((point.longitudeDeg + 180).toFixed(2) + ',' + (90 - point.latitudeDeg).toFixed(2))
  })
  return <figure className="plan-preview">
    <svg viewBox="0 0 360 180" role="img" aria-label="Six hour ground track over a longitude and latitude grid with the target center marked">
      <rect width="360" height="180" fill="#0b1520" />
      {[30, 60, 90, 120, 150].map(y => <path key={y} d={`M0,${y} H360`} stroke="#34505f" strokeWidth=".45" />)}
      {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(x => <path key={x} d={`M${x},0 V180`} stroke="#34505f" strokeWidth=".45" />)}
      {lines.map((points, index) => <polyline key={index} points={points.join(' ')} fill="none" stroke="#74e7c2" strokeWidth="1.1" />)}
      <circle cx={target.longitudeDeg + 180} cy={90 - target.latitudeDeg} r="2.7" fill="#ffd08a" />
    </svg>
    <figcaption>Six-hour ground track sampled every minute. The amber marker shows the target center. Geography uses a rotating sphere with a fictional meridian at the start epoch.</figcaption>
  </figure>
}

function downloadMission(mission: MissionConfiguration) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(mission, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `mission-${mission.id}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Planner() {
  const [stored, setStored] = useState<{ raw: string; save: Save } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [justApproved, setJustApproved] = useState(false)
  const [plan, setPlan] = useState(defaultPlan)
  const [craft, setCraft] = useState('draft')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    let mounted = true
    readLocal().then(({ raw }) => {
      if (!mounted) return
      if (raw !== undefined) setStored({ raw, save: decodeSave(raw) })
      setLoaded(true)
    }).catch(reason => {
      if (!mounted) return
      setError(reason instanceof Error ? reason.message : 'Unable to open the agency save.')
      setLoaded(true)
    })
    return () => { mounted = false }
  }, [])
  const save = stored?.save
  const history = save?.missions ?? []
  const assembly = craft === 'draft' ? save?.assembly : history.find(mission => mission.id === craft)?.assembly
  const context = save ? approvalContext(save.id, save.agency) : null
  const assessment = useMemo(() => {
    if (!save || !assembly) return null
    const { availableCents, capabilities } = approvalContext(save.id, save.agency)
    return review(plan, assembly, availableCents, capabilities)
  }, [save, assembly, plan])
  const failures = assessment?.findings.filter(finding => finding.status === 'FAIL').length ?? 0
  const warnings = assessment?.findings.filter(finding => finding.status === 'WARNING').length ?? 0

  async function approve() {
    if (!stored || !save || !assembly || !context || !assessment || failures || justApproved ||
      pending.current || history.length >= maxApprovedMissions) return
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const mission = approveMission(crypto.randomUUID(), plan, assembly, context)
      const agency = applyCommand(save.agency, { id: mission.id, kind: 'reserve-mission', cents: mission.budget.totalCents })
      const raw = await writeLocal(stored.raw, { ...save, revision: save.revision + 1, agency, missions: [...history, mission] })
      setStored({ raw, save: decodeSave(raw) })
      setJustApproved(true)
      setNotice(`${mission.objective.label} approved. ${usd(mission.budget.totalCents)} committed.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the approved mission.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function revise(mission: MissionConfiguration) {
    setJustApproved(false)
    setPlan({ ...mission.plan, revisedFrom: mission.id })
    setCraft(mission.id)
    setNotice('Revision started from an approved snapshot. Select the current saved draft to use newer hardware.')
    document.getElementById('science-objective')?.focus()
  }

  function startNew() {
    setCraft('draft')
    setPlan(defaultPlan)
    setNotice('')
    setJustApproved(false)
    document.getElementById('science-objective')?.focus()
  }

  return <div className="hq planner">
    <a className="skip-link" href="#mission-planning">Skip to mission planning</a>
    <header className="hq-top"><div className="hq-shell hq-top-inner">
      <a className="hq-brand" href="?">MISSION CONTROL</a>
      <nav className="hq-actions" aria-label="Workspaces"><a className="hq-nav-link" href="?">Headquarters</a><a className="hq-nav-link" href="?mode=assembly">Vehicle Assembly</a></nav>
    </div></header>
    <main className="hq-shell hq-main" id="mission-planning" tabIndex={-1}>
      <div className="hq-heading"><div><p className="hq-kicker">Earth observation program</p><h1>Mission planning</h1>
        <p>Select a spacecraft, define the observing scenario, and review the evidence before committing funds.</p></div>
        {save && <div className="plan-agency"><strong>{save.agency.name}</strong><span>Program day {save.agency.day}</span></div>}</div>
      <div className="hq-status" role="status">{busy ? 'Committing mission…' : notice || (!loaded ? 'Opening local agency save…' : '')}</div>
      {error && <div className="hq-alert" role="alert">{error} <a href="?mode=planning">Reload planner</a></div>}
      {loaded && !save && !error && <p>Create or open an agency in <a href="?">Headquarters</a> to continue.</p>}
      {save && <div className="plan-console">
        <section className="hq-panel plan-setup" aria-labelledby="design-heading">
          <h2 id="design-heading">Mission design</h2>
          <p className="hq-small">Earth observation training contract reference. Approval reserves agency cash for this plan.</p>
          <div className="plan-fields">
            <label>Spacecraft <select value={craft} onChange={event => setCraft(event.target.value)}>
              <option value="draft">{save.assembly ? `Saved assembly · revision ${save.assembly.revision}` : 'No saved assembly'}</option>
              {history.map(mission => <option key={mission.id} value={mission.id}>Approved snapshot · {mission.objective.label} · {mission.id.slice(0, 8)}</option>)}
            </select></label>
            <label>Science objective <select id="science-objective" value={plan.objective} onChange={event => {
              const objective = event.target.value as Plan['objective']
              setPlan({ ...plan, objective, target: objective === 'crops' ? 'valley' : 'delta' })
            }}>{Object.entries(objectives).map(([id, objective]) => <option key={id} value={id}>{objective.label}</option>)}</select></label>
            <label>Target region <select value={plan.target} onChange={event => setPlan({ ...plan, target: event.target.value as Plan['target'] })}>
              {Object.entries(targets).map(([id, target]) => <option key={id} value={id}>{target.label}</option>)}
            </select></label>
            <label>Launch service <select value={plan.launch} onChange={event => setPlan({ ...plan, launch: event.target.value as Plan['launch'] })}>
              {Object.entries(launches).map(([id, launch]) => <option key={id} value={id}>{launch.label}</option>)}
            </select></label>
          </div>
          <fieldset><legend>Orbital elements</legend>
            <div className="plan-fields plan-orbit-fields">{fields.map(([field, label]) => <label key={field}>{label}
              <input type="number" step="any" value={Number.isFinite(plan.orbit[field]) ? plan.orbit[field] : ''}
                onChange={event => setPlan({ ...plan, orbit: { ...plan.orbit, [field]: event.target.valueAsNumber } })} />
            </label>)}</div>
            <p className="hq-small">Both apsides must be within 300–1,500 km. Inclination is 0–180°. Other angles use 0° to below 360°.</p>
          </fieldset>
          {plan.revisedFrom && <p className="hq-small">Revising {plan.revisedFrom.slice(0, 8)}. Approval creates a new commitment. <button onClick={startNew}>Start a new plan</button></p>}
        </section>
        <section className="hq-panel plan-analysis" aria-labelledby="preview-heading">
          <h2 id="preview-heading">Trajectory and spacecraft</h2>
          {assessment ? <>
            <Preview orbit={assessment.orbit} target={assessment.target} />
            <p className="hq-small">{assessment.objective.product}. Goal: {assessment.objective.scenes} usable delivered scenes.</p>
            <dl className="plan-metrics">
              <div><dt>Target center · lat / lon</dt><dd>{assessment.target.latitudeDeg.toFixed(2)}°, {assessment.target.longitudeDeg.toFixed(2)}°</dd></div>
              <div><dt>Orbital period</dt><dd>{assessment.orbit ? `${(assessment.orbit.initialState.periodS / 60).toFixed(1)} min` : 'Unavailable'}</dd></div>
              <div><dt>Perigee / apogee</dt><dd>{assessment.orbit ? `${(assessment.orbit.perigeeM / 1000).toFixed(0)} / ${(assessment.orbit.apogeeM / 1000).toFixed(0)} km` : 'Unavailable'}</dd></div>
              <div><dt>Wet mass / service limit</dt><dd>{assessment.spacecraft.wetKg.toFixed(2)} / {assessment.launch.maxWetKg} kg</dd></div>
              <div><dt>Stowed XYZ</dt><dd>{assessment.spacecraft.dimensionsM.map(value => value.toFixed(3)).join(' × ')} m</dd></div>
              <div><dt>Nominal output / peak load</dt><dd>{assessment.spacecraft.power.nominalGenerationW} / {assessment.spacecraft.power.maxConcurrentLoadW} W</dd></div>
              <div><dt>Battery capacity</dt><dd>{(assessment.spacecraft.power.batteryCapacityJ / 3600).toFixed(1)} Wh</dd></div>
              <div><dt>Radio bit-rate cap</dt><dd>{(assessment.spacecraft.communications?.maxBitRateBps ?? 0) / 1000} kb/s</dd></div>
              <div><dt>Mounted camera wavelengths</dt><dd>{assessment.spacecraft.payload?.bandsM.map(band => band.map(value => (value * 1e6).toFixed(2)).join('–')).join(', ') ?? 'None'}{assessment.spacecraft.payload && ' µm'}</dd></div>
            </dl>
          </> : <p><a href="?mode=assembly">Build and save a spacecraft in Vehicle Assembly</a> to begin the engineering review.</p>}
        </section>
        {assessment && <>
          <section className="hq-panel plan-readiness" aria-labelledby="readiness-heading">
            <h2 id="readiness-heading">Readiness review</h2>
            <p>{failures ? `${failures} blocking · ${warnings} warnings` : `Ready for planning approval · ${warnings} warnings`}</p>
            <ul className="plan-findings">{assessment.findings.map(finding => <li key={finding.id}>
              <span className={`plan-status ${finding.status.toLowerCase()}`}>{finding.status}</span>
              <div><strong>{finding.id}</strong><p>{finding.explanation}</p>
                {finding.source && <a href={missionSources[finding.source].url} target="_blank" rel="noreferrer">{missionSources[finding.source].title}</a>}</div>
            </li>)}</ul>
          </section>
          <section className="hq-panel plan-budget" aria-labelledby="budget-heading">
            <h2 id="budget-heading">Funding review</h2>
            <p className="hq-small">Illustrative USD estimates. Approval commits funds. Cash is paid during a later phase.</p>
            <dl className="hq-key-values">
              <div><dt>Hardware procurement</dt><dd>{usd(assessment.budget.hardwareCents)}</dd></div>
              <div><dt>Launch service</dt><dd>{usd(assessment.budget.launchCents)}</dd></div>
              <div><dt>Operations allowance</dt><dd>{usd(assessment.budget.operationsCents)}</dd></div>
              <div><dt>Total projected commitment</dt><dd>{usd(assessment.budget.totalCents)}</dd></div>
              <div><dt>Available now</dt><dd>{usd(assessment.budget.availableCents)}</dd></div>
            </dl>
            {justApproved ? <button onClick={startNew}>Start a new plan</button> :
              <button className="hq-primary" disabled={busy || failures > 0 || history.length >= maxApprovedMissions} onClick={() => void approve()}>Approve and commit funds</button>}
            <p className="hq-small">{justApproved ? 'Review or export the approved snapshot below.' : history.length >= maxApprovedMissions ? 'The local approved-plan history is full.' : failures ? 'Resolve blocking checks to approve.' : 'Approval freezes the inputs, assumptions, and unresolved warnings for handoff.'}</p>
            <details className="hq-detail"><summary>Scientific inputs and limits</summary>
              <p>JPL gravity and sidereal rotation and NASA Landsat 9 band intervals are sourced. Vehicle, cost, target centers, station, and lighting are illustrative. The orbit kernel is TESTED.</p>
              <ul>{Object.values(missionSources).map(source => <li key={source.locator + source.title}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.locator}</li>)}</ul>
            </details>
          </section>
        </>}
        <section className="hq-panel plan-history" aria-labelledby="history-heading">
          <h2 id="history-heading">Approved missions</h2>
          {history.length ? <ul>{history.map(mission => <li key={mission.id}>
            <div><strong>{mission.objective.label} · {mission.id.slice(0, 8)}</strong><p>Day {mission.approval.programDay} · spacecraft revision {mission.assembly.revision} · {usd(mission.budget.totalCents)} committed</p></div>
            <div className="hq-actions"><button onClick={() => revise(mission)}>Revise {mission.id.slice(0, 8)}</button><button onClick={() => downloadMission(mission)}>Export mission JSON <span className="plan-id">{mission.id.slice(0, 8)}</span></button></div>
          </li>)}</ul> : <p>Approved mission snapshots will appear here.</p>}
        </section>
      </div>}
    </main>
  </div>
}
