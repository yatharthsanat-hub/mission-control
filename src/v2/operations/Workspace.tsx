import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readLocal, writeLocal } from '../localSaves.ts'
import { decodeSave } from '../saveFormat.ts'
import type { Save } from '../saveFormat.ts'
import { forecastApprovedMission } from '../planning/mission.ts'
import type { ExecutableMission } from '../planning/mission.ts'
import type { Forecast } from '../planning/forecast.ts'
import { accessReasons } from '../planning/flightModel.ts'
import { createMissionRun } from './run.ts'
import type { CommandKind, MissionRecord, MissionTelemetry } from './run.ts'
import { OrbitView } from './OrbitView.tsx'
import { LunarReview } from './LunarReview.tsx'
import { createDemo, demoCheckpointKey, readDemoCheckpoint } from './demo.ts'
import '../headquarters.css'
import './operations.css'

type OpenSave = { raw: string; save: Save }
const message = (error: unknown) => error instanceof Error ? error.message : 'Mission operation failed.'
const clock = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
const sizeMB = (bits: number) => (bits / 8e6).toFixed(2) + ' MB'
const money = (cents: number) => new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(cents / 100)
const percent = (chargeJ: number, capacityJ: number) => capacityJ ? 100 * chargeJ / capacityJ : 0

function EventLog({ events }: Pick<MissionTelemetry, 'events'>) {
  const [all, setAll] = useState(false)
  const visible = all ? events : events.slice(-8)
  return <section className="hq-panel ops-events" aria-labelledby="ops-events">
    <div className="ops-panel-head"><div><h2 id="ops-events">Mission event log</h2><p>Elapsed times · {events.length} recorded</p></div>
      {events.length > 8 && <button onClick={() => setAll(value => !value)}>{all ? 'Show recent' : 'Show all events'}</button>}</div>
    <ol tabIndex={0} aria-label="Mission events">
      {visible.map((event, index) => <li className={event.kind} key={events.length - visible.length + index}>
        <time>T+{clock(event.atS)}</time><span>{event.text}</span></li>)}
    </ol>
  </section>
}

function Windows({ forecast, elapsedS, lunar }: { forecast: Forecast; elapsedS: number; lunar: boolean }) {
  const lanes = [['Target access', forecast.accesses, 'target'], [lunar ? 'Earth service' : 'Ground contact', forecast.contacts, 'station'], ['Eclipse', forecast.eclipses, 'eclipse']] as const
  return <section className="hq-panel ops-windows" aria-labelledby="windows-heading">
    <h2 id="windows-heading">Opportunity timeline</h2>
    <p>Geometry windows from the shared flight model · White cursor marks mission time</p>
    {lanes.map(([name, windows, tone]) => <div key={name} className="ops-lane"><span>{name}</span><svg viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true">
      {[250, 500, 750].map(x => <line key={x} x1={x} x2={x} y1="0" y2="16" />)}
      {windows.map(window => <rect key={window.startS} className={tone} x={1000 * window.startS / forecast.durationS}
        width={1000 * (window.endS - window.startS) / forecast.durationS} height="16" />)}
      <line className="cursor" x1={Math.min(999, 1000 * elapsedS / forecast.durationS)} x2={Math.min(999, 1000 * elapsedS / forecast.durationS)} y1="0" y2="16" />
    </svg></div>)}
    <div className="ops-scale" aria-hidden="true"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
    <details className="hq-detail"><summary>Window times and durations</summary>
      <ul>{lanes.flatMap(([name, windows]) => windows.map(window => <li key={name + window.startS}>{name} · T+{clock(window.startS)} · {window.endS - window.startS} s</li>))}</ul>
    </details>
  </section>
}

function ScienceReview({ mission, forecast, data, demo }: { mission: ExecutableMission; forecast: Forecast; data: MissionTelemetry; demo: boolean }) {
  const { resources, goal } = data
  const sceneBits = mission.spacecraft.payload.sceneBits
  const lunar = mission.schemaVersion === 3
  const rows = [
    ['Target windows', forecast.accesses.length, data.targetWindows],
    [lunar ? 'Assumed Earth service windows' : 'Ground contacts', forecast.contacts.length, data.contactWindows],
    ['Scenes acquired', forecast.science.captured, resources.captured],
    ['Science acquired', sizeMB(forecast.science.captured * sceneBits), sizeMB(resources.captured * sceneBits)],
    ['Missed observing windows while below quota', '—', data.missedObservations],
    ['Missed contacts with queued data', '—', data.missedContacts],
    ['Complete scenes delivered', forecast.communications.delivered, resources.delivered],
    ['Data transmitted', sizeMB(forecast.communications.deliveredBits), sizeMB(resources.deliveredBits)],
    ['Data remaining onboard', sizeMB(forecast.science.onboardBits), sizeMB(resources.occupiedBits)],
    ['Minimum battery charge', percent(forecast.power.minChargeJ, forecast.power.capacityJ).toFixed(1) + '%',
      percent(data.minChargeJ, forecast.power.capacityJ).toFixed(1) + '%'],
    ['Unserved housekeeping energy', forecast.power.unmetJ.toFixed(1) + ' J', data.unmetJ.toFixed(1) + ' J'],
  ] as const
  return <section className="hq-panel ops-review" aria-labelledby="review-heading">
    <div className="ops-panel-head"><div><h2 id="review-heading">Science and Program Review</h2><p>{mission.objective.product} · {mission.target.label}</p></div>
      <strong className={data.verdict === 'Success' ? 'hq-good' : 'hq-warn'}>{data.verdict}</strong></div>
    <div className="ops-review-counts">
      <div><span>Target windows</span><strong>{data.targetWindows}</strong></div>
      <div><span>Scenes acquired</span><strong>{resources.captured}</strong></div>
      <div><span>Complete scenes delivered</span><strong>{resources.delivered} / {goal}</strong></div>
    </div>
    <p className="ops-result-line">{resources.delivered} of {goal} required complete scenes delivered. Acquisition requires the approved spectral bands, adequate lighting and a sampling distance of {mission.objective.groundSampleLimitM} m/px or finer.</p>
    <ul className="ops-reasons">
      {resources.delivered >= goal && <li>Science objective satisfied. All credited scenes arrived in full.</li>}
      {resources.delivered < goal && <li>The science requirement fell short by {goal - resources.delivered} complete scene(s).</li>}
      {data.missedObservations > 0 && <li>{data.missedObservations} target window(s) closed before capture while the scene quota was still open. See the event log for command and power causes.</li>}
      {data.missedContacts > 0 && <li>{data.missedContacts} geometric contact(s) passed without transmission while data was queued.</li>}
      {resources.occupiedBits > 0 && <li>{sizeMB(resources.occupiedBits)} remains onboard. Partly transmitted scenes earn credit only when complete.</li>}
      {data.unmetJ > 0 && <li>Housekeeping power was interrupted, so the run did not meet full engineering success.</li>}
      {data.unmetJ === 0 && <li>Housekeeping demand was fully served.</li>}
    </ul>
    <div className="hq-table-scroll" tabIndex={0} role="region" aria-label="Predicted versus actual mission results">
      <table><thead><tr><th>Measure</th><th>Planning forecast</th><th>Actual run</th></tr></thead>
        <tbody>{rows.map(([label, predicted, actual]) => <tr key={label}><th scope="row">{label}</th><td>{predicted}</td><td>{actual}</td></tr>)}</tbody></table>
    </div>
    <h3>Program accounting</h3><p>{money(mission.budget.totalCents)} was committed in {demo ? 'the isolated demo ledger' : 'the agency ledger'} at approval. Mission runs and replays add no charges or grants.</p>
    <details className="hq-detail"><summary>Scientific sources and model confidence</summary>
      <p>{lunar ? 'Lunar two-body propagation is TESTED. The lunar sphere, Sun direction, and Earth visibility scenario are ILLUSTRATIVE.' : 'Two-body propagation and free-space path loss are TESTED. Integrated mission behavior is ILLUSTRATIVE.'} RF link margin is NOT ASSESSED. Received data use the acknowledged illustrative service rate.</p>
      <p>Flight inputs · {mission.models.orbit} · {mission.analysisProfile.revision} · {mission.catalogRevision}</p>
      <ul>{Object.entries(mission.sources).map(([id, source]) => <li key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.locator}</li>)}</ul>
    </details>
  </section>
}

function Flight({ mission, opened, demo = false }: { mission: ExecutableMission; opened: OpenSave; demo?: boolean }) {
  const store = useRef(opened)
  const saveQueue = useRef(Promise.resolve())
  const saveRequest = useRef(0)
  const checkpoint = opened.save.operations?.find(item => item.missionId === mission.id)
  const [run, setRun] = useState(() => createMissionRun(mission, checkpoint))
  const [data, setData] = useState(() => run.snapshot())
  const [started, setStarted] = useState(Boolean(checkpoint))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)
  const [status, setStatus] = useState(checkpoint ? 'Saved flight restored.' : '')
  const [error, setError] = useState('')
  const carry = useRef(0)
  const forecast = useMemo(() => forecastApprovedMission(mission), [mission])
  const { stepS, durationS } = mission.analysisProfile
  const lunar = mission.schemaVersion === 3

  const saveProgress = useCallback((record: MissionRecord) => {
    if (demo) {
      try {
        window.sessionStorage.setItem(demoCheckpointKey, JSON.stringify(record))
        setStatus('Demo checkpoint saved in this tab.')
      } catch { setStatus('Demo checkpoint stays in memory until this page closes.') }
      return
    }
    const request = ++saveRequest.current
    setStatus('Saving flight…')
    saveQueue.current = saveQueue.current.then(async () => {
      const { raw, save } = store.current
      const operations = [...(save.operations ?? []).filter(item => item.missionId !== mission.id), record]
      const updated = { ...save, operations, revision: save.revision + 1 }
      store.current = { raw: await writeLocal(raw, updated), save: updated }
      if (request === saveRequest.current) {
        setError('')
        setStatus('Flight saved on this device.')
      }
    }).catch(reason => {
      if (request === saveRequest.current) {
        setError(message(reason))
        setStatus('Flight checkpoint not saved.')
      }
    })
  }, [demo, mission.id])

  useEffect(() => {
    if (!playing) return
    let previous = performance.now()
    let lastSave = previous
    const timer = window.setInterval(() => {
      const now = performance.now()
      carry.current += (now - previous) * speed / 1000
      previous = now
      const bins = Math.floor(carry.current / stepS)
      if (!bins) return
      carry.current -= bins * stepS
      run.advance(bins)
      const current = run.snapshot()
      setData(current)
      if (current.complete) {
        window.clearInterval(timer)
        setPlaying(false)
      }
      if (current.complete || now - lastSave >= 12_000) {
        saveProgress(run.record())
        lastSave = now
      }
    }, 160)
    return () => window.clearInterval(timer)
  }, [playing, run, speed, stepS, saveProgress])

  function send(kind: CommandKind) {
    setError('')
    try {
      run.command(kind)
      if (kind === 'image-now' || kind === 'downlink-now') {
        setPlaying(false)
        run.advance(1)
      }
      setData(run.snapshot())
      saveProgress(run.record())
    } catch (reason) { setError(message(reason)) }
  }

  function advanceTo(nextS: number) {
    setPlaying(false)
    carry.current = 0
    run.advance(Math.max(0, (nextS - run.record().elapsedS) / stepS))
    setData(run.snapshot())
    saveProgress(run.record())
  }

  function reset() {
    setPlaying(false)
    carry.current = 0
    const resetRun = createMissionRun(mission)
    setRun(resetRun)
    setData(resetRun.snapshot())
    saveProgress(resetRun.record())
  }

  const nextTarget = forecast.accesses.find(window => window.startS > data.elapsedS)
  const nextContact = forecast.contacts.find(window => window.startS > data.elapsedS)
  const { upcoming, orbital, resources } = data
  const battery = percent(resources.chargeJ, mission.spacecraft.power.batteryCapacityJ)
  const storage = percent(resources.occupiedBits, mission.spacecraft.storageCapacityBits)
  const latestEvent = data.events.findLast(event => event.kind === 'warning' || event.kind === 'science' ||
    event.text.startsWith('Manual transmission'))

  return <>
    <div className="ops-title"><div><p className="hq-kicker">{demo ? 'Demo flight' : 'Mission Control'} · {lunar ? 'Lunar reconnaissance' : 'Earth observation'}</p><h1>{mission.objective.label}</h1>
      <p>{mission.target.label} · Approved spacecraft revision {mission.assembly.revision}</p>
      {lunar && <p>Flight begins in Moon-centered orbit after assumed insertion.</p>}</div>
      <div className="ops-clock"><span>{data.complete ? 'Mission complete' : !started ? 'Awaiting start' : playing ? 'Running' : 'Paused'}</span>
        <strong>T+{clock(data.elapsedS)}</strong><small>Elapsed TDB · {mission.orbit.elements.frame}</small></div></div>
    <p className="ops-save" role="status">{status}</p>
    {error && <p className="hq-alert" role="alert">{error} <a href={location.search}>Reload saved flight</a></p>}
    {demo && !data.complete && <aside className="mission-route-note">
      <strong>Return {data.goal} complete scenes</strong>
      <p>{!started ? 'Start the mission and use Go to next target to reach a valid imaging window.' :
        resources.captured === 0 ? 'Go to next target, then Capture now. You can arm imaging to capture automatically at later eligible windows.' :
          resources.delivered < data.goal ? 'Arm imaging and downlink, then Run to end & review. Scenes left onboard cannot count toward the objective.' :
            'The required scenes are on the ground. Run to end to review the mission.'}</p>
    </aside>}
    {data.complete && <ScienceReview mission={mission} forecast={forecast} data={data} demo={demo} />}
    {data.complete && mission.schemaVersion === 3 && <LunarReview mission={mission} data={data} save={opened.save} />}
    <div className="ops-grid">
      <OrbitView mission={mission} telemetry={data} />
      <section className="hq-panel ops-console" aria-labelledby="console-heading">
        <h2 id="console-heading">Flight console</h2>
        <div className="ops-transport">
          {!started ? <button className="hq-primary" onClick={() => { setStarted(true); saveProgress(run.record()) }}>Start mission</button> :
            <button className="hq-primary" disabled={data.complete} onClick={() => {
              if (playing) saveProgress(run.record())
              setPlaying(!playing)
            }}>{playing ? 'Pause' : 'Play'}</button>}
          <label>Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
            {[1, 120, 600, 3600].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
          <button disabled={!started || data.complete} onClick={() => advanceTo(data.elapsedS + stepS)}>Step 5 s</button>
        </div>
        <dl className="ops-telemetry">
          <div><dt>Altitude</dt><dd>{(orbital.altitudeM / 1000).toFixed(1)} km</dd></div>
          <div><dt>Inertial speed</dt><dd>{(Math.hypot(...orbital.velocityMps) / 1000).toFixed(3)} km/s</dd></div>
          <div><dt>Illumination {data.complete ? '· final interval' : '· next interval'}</dt><dd>{upcoming.eclipse ? 'Eclipse' : 'Sunlight'} · {upcoming.generationW.toFixed(1)} W</dd></div>
          <div><dt>Load · last interval</dt><dd>{data.lastLoadW.toFixed(1)} W · {data.lastActivity}</dd></div>
        </dl>
        <div className="ops-meter"><label htmlFor="ops-battery">Battery</label><output>{battery.toFixed(1)}%</output>
          <meter id="ops-battery" min={0} max={100} low={15} value={battery} /></div>
        <div className="ops-meter"><label htmlFor="ops-storage">Onboard data</label><output>{sizeMB(resources.occupiedBits)} / {sizeMB(mission.spacecraft.storageCapacityBits)}</output>
          <meter id="ops-storage" min={0} max={100} value={storage} /></div>
        <div className="ops-science-count"><span>Acquired <strong>{resources.captured}</strong></span><span>Delivered <strong>{resources.delivered} / {data.goal}</strong></span></div>
        <p className="hq-small">{sizeMB(resources.deliveredBits)} received on the ground, including partial transmissions.</p>
        <fieldset disabled={!started || data.complete}>
          <legend>Imaging</legend>
          <p>{upcoming.access.available ? `Target window open · ${upcoming.access.bestGsdM.toFixed(1)} m/px` : accessReasons[upcoming.access.reason]}</p>
          <p>Capture now requests one exposure in the next step. Armed imaging waits for a qualifying view.</p>
          <div className="ops-actions">
            <button type="button" aria-pressed={data.imaging} onClick={() => send(data.imaging ? 'standby-imaging' : 'arm-imaging')}>{data.imaging ? 'Hold imaging' : 'Arm imaging'}</button>
            <button type="button" onClick={() => send('image-now')}>Capture now</button>
            <button type="button" disabled={!nextTarget} onClick={() => nextTarget && advanceTo(nextTarget.startS)}>Go to next target</button>
          </div>
        </fieldset>
        <fieldset disabled={!started || data.complete}>
          <legend>Downlink</legend>
          <p>{lunar ? (upcoming.station.inContact ? 'Assumed Earth direction clear of lunar limb.' : 'Moon occults the assumed Earth direction.') :
            (upcoming.station.inContact ? `Contact above mask · ${upcoming.station.elevationDeg?.toFixed(1)}°` : 'Station outside contact mask.')} RF margin NOT ASSESSED.</p>
          <p>{resources.occupiedBits ? 'Armed downlink sends queued data when geometry and power permit.' : 'No data queued. Capture a scene before transmitting.'}</p>
          <div className="ops-actions">
            <button type="button" aria-pressed={data.radio} onClick={() => send(data.radio ? 'standby-downlink' : 'arm-downlink')}>{data.radio ? 'Hold downlink' : 'Arm downlink'}</button>
            <button type="button" onClick={() => send('downlink-now')}>Transmit 5 s now</button>
            <button type="button" disabled={!nextContact} onClick={() => nextContact && advanceTo(nextContact.startS)}>Go to next contact</button>
          </div>
        </fieldset>
        {data.pending.length > 0 && <p className="hq-small">Commands queued for the next 5 s interval.</p>}
        {latestEvent && <p className={`ops-feedback ${latestEvent.kind === 'warning' ? 'hq-warn' : ''}`} role="status">T+{clock(latestEvent.atS)} · {latestEvent.text}</p>}
        {battery <= 15 && !data.complete && <p className="hq-warn">Battery reserve advisory. Hold imaging or downlink to reduce load.</p>}
        <div className="ops-actions ops-close">
          <button disabled={!started} onClick={() => { setPlaying(false); saveProgress(run.record()) }}>Save checkpoint</button>
          <button disabled={!started} onClick={reset}>Reset flight</button>
          <button disabled={!started || data.complete} onClick={() => advanceTo(durationS)}>Run to end &amp; review</button>
        </div>
        <p className="hq-small">Jump and end controls simulate every intervening interval with the current modes.</p>
      </section>
      <Windows forecast={forecast} elapsedS={data.elapsedS} lunar={lunar} />
      <EventLog events={data.events} />
    </div>
  </>
}

function DemoFlight() {
  const [{ mission, opened }] = useState(() => {
    const { mission, save } = createDemo()
    let checkpoint
    try { checkpoint = readDemoCheckpoint(mission, window.sessionStorage) } catch { /* Flight is still playable in memory. */ }
    return { mission, opened: { raw: '', save: { ...save, operations: checkpoint ? [checkpoint] : [] } } }
  })
  return <div className="hq ops">
    <header className="hq-top"><div className="hq-shell hq-top-inner"><a href="?" className="hq-brand">MISSION CONTROL</a><a href="?">Exit demo</a></div></header>
    <main className="hq-shell hq-main"><Flight mission={mission} opened={opened} demo /></main>
  </div>
}

export default function Workspace({ demo }: { demo: boolean }) {
  return demo ? <DemoFlight /> : <AgencyFlights />
}

function AgencyFlights() {
  const [opened, setOpened] = useState<OpenSave | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const missionId = new URLSearchParams(location.search).get('mission')
  useEffect(() => {
    let alive = true
    readLocal().then(({ raw }) => {
      if (alive && raw) setOpened({ raw, save: decodeSave(raw) })
    }).catch(reason => { if (alive) setError(message(reason)) })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])
  const missions = opened?.save.missions ?? []
  const mission = missions.find(item => item.id === missionId)
  return <div className="hq ops">
    <a className="skip-link" href="#operations">Skip to Mission Control</a>
    <header className="hq-top"><div className="hq-shell hq-top-inner">
      <a href="?" className="hq-brand">MISSION CONTROL</a>
      <nav className="hq-actions" aria-label="Workspaces"><a href="?" className="hq-nav-link">Missions</a><a href="?mode=headquarters" className="hq-nav-link">Headquarters</a>
        <a href="?mode=planning" className="hq-nav-link">Mission Planning</a><a href="?mode=operations" className="hq-nav-link">Approved missions</a></nav>
    </div></header>
    <main id="operations" className="hq-shell hq-main" tabIndex={-1}>
      {mission && mission.schemaVersion !== 1 && opened ? <Flight mission={mission} opened={opened} /> : <section className="hq-panel ops-list">
        <h1>Mission Control</h1>
        {!loaded && <p role="status">Opening agency flight records…</p>}
        {error && <p className="hq-alert" role="alert">{error}</p>}
        {loaded && !error && !missions.length && <p>Approve a mission in <a href="?mode=planning">Mission Planning</a> to enter operations.</p>}
        {loaded && missionId && !mission && missions.length > 0 && <p>Choose an approved mission below.</p>}
        {missions.length > 0 && <ul>{missions.map(item => {
          const record = opened?.save.operations?.find(entry => entry.missionId === item.id)
          return <li key={item.id}><div><strong>{item.objective.label} · {item.id.slice(0, 8)}</strong><p>{item.target.label}</p></div>
            {item.schemaVersion === 1 ? <span>Legacy approval · <a href="?mode=planning">Revise and reapprove in Mission Planning</a></span> :
              <a className="hq-nav-link" href={`?mode=operations&mission=${item.id}`}>{record?.elapsedS === item.analysisProfile.durationS ? 'Open review' : record ? 'Resume mission' : 'Open Mission Control'}</a>}
          </li>
        })}</ul>}
      </section>}
    </main>
  </div>
}
