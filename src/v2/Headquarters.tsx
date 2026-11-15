import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../game/Visuals.tsx'
import { applyCommand, createAgency, finances, lunarGrantCents, lunarGrantClaimed, unlockedCapabilities } from './agency.ts'
import type { Command } from './agency.ts'
import { readLocal, writeLocal } from './localSaves.ts'
import type { StoredSave } from './localSaves.ts'
import { decodeSave, encodeSave, maxSaveSize } from './saveFormat.ts'
import type { Save } from './saveFormat.ts'
import { assessTraining, payloads, research, startingGrantCents, training, trainingCommitmentCents, trainingEstimateCents } from './training.ts'
import type { PayloadId, TrainingOrbitM } from './training.ts'
import { earthGravity, orbitModel } from './physics/twoBody.ts'
import { sources } from './sources.ts'
import './headquarters.css'
import { missionEntry } from './missionEntry.ts'

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd = (cents: number) => dollars.format(cents / 100)
type Intent = { kind: 'fund-training' | 'start-research' | 'advance-day' | 'claim-lunar-grant' } | Omit<Extract<Command, { kind: 'submit-review' }>, 'id'>

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Local storage is unavailable or the action failed.'
}

function readBackup(raw: string | undefined) {
  try { return raw === undefined ? null : decodeSave(raw) }
  catch { return null }
}

function download(raw: string, name: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Headquarters() {
  const [stored, setStored] = useState<StoredSave | null>(null)
  const [save, setSave] = useState<Save | null>(null)
  const [candidate, setCandidate] = useState<Save | null>(null)
  const [restoringArchive, setRestoringArchive] = useState(false)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)

  useEffect(() => {
    let mounted = true
    readLocal().then(data => {
      if (!mounted) return
      setStored(data)
      if (data.raw !== undefined) setSave(decodeSave(data.raw))
    }).catch(reason => { if (mounted) setError(errorText(reason)) })
    return () => { mounted = false }
  }, [])

  async function act(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try { await action() }
    catch (reason) { setError(errorText(reason)) }
    finally { pending.current = false; setBusy(false) }
  }

  async function reload() {
    const data = await readLocal()
    setStored(data)
    setSave(null)
    setCandidate(null)
    if (data.raw !== undefined) setSave(decodeSave(data.raw))
    setNotice('Local save reloaded.')
  }

  async function install(next: Save, mode: 'update' | 'replace') {
    if (!stored) throw new Error('Local saves must finish loading before writing.')
    const raw = await writeLocal(stored.raw, next, mode)
    setSave(decodeSave(raw))
    setStored({ ...stored, raw, backup: raw === stored.raw || !save ? stored.backup : stored.raw })
    if (mode === 'replace') {
      const latest = await readLocal()
      setStored(latest)
      setSave(latest.raw === undefined ? null : decodeSave(latest.raw))
    }
    setNotice(raw === stored.raw ? 'This save is already active.' : 'Saved on this device.')
    setCandidate(null)
  }

  function create(event: FormEvent) {
    event.preventDefault()
    void act(() => install({ id: crypto.randomUUID(), revision: 0, agency: createAgency(name) }, 'update'))
  }

  function dispatch(intent: Intent) {
    void act(async () => {
      if (!save) throw new Error('Open an agency first.')
      const agency = applyCommand(save.agency, { ...intent, id: crypto.randomUUID() })
      await install({ ...save, agency, revision: save.revision + 1 }, 'update')
    })
  }

  const damaged = stored !== null && stored.raw !== undefined && !save
  const backup = damaged ? readBackup(stored.backup) : null
  const requested = new URLSearchParams(location.search).get('next')
  const next = requested === 'earth' || requested === 'moon' ? missionEntry(requested, save) : null

  return (
    <div className="hq">
      <a className="skip-link" href="#headquarters">Skip to headquarters</a>
      <header className="hq-top">
        <div className="hq-shell hq-top-inner">
          <a className="hq-brand" href="?"><span className="hq-mark"><Icon name="orbit" /></span>MISSION CONTROL</a>
          <nav className="hq-actions" aria-label="Workspaces">
            {save && <a className="hq-nav-link" href="?mode=assembly">Vehicle Assembly</a>}
            {save && <a className="hq-nav-link" href="?mode=planning">Mission Planning</a>}
            {save?.missions?.length ? <a className="hq-nav-link" href="?mode=operations">Mission Operations</a> : null}
            <a className="hq-nav-link" href="?mode=tutorial">CubeSat tutorial <Icon name="arrow" /></a>
          </nav>
        </div>
      </header>
      <main className="hq-shell hq-main" id="headquarters" tabIndex={-1}>
        <div className="hq-heading">
          <div><p className="hq-kicker">Agency headquarters</p><h1>{save?.agency.name ?? 'Establish your agency'}</h1>
            <p>{save ? 'Manage funding, review your first Earth observation concept, and develop a new spacecraft capability.' : 'Create a fictional agency and review your first Earth observation concept.'}</p></div>
          {save && <div className="hq-calendar"><span>Program day</span><strong>{save.agency.day}</strong><button disabled={busy} onClick={() => dispatch({ kind: 'advance-day' })}>Advance 1 day</button></div>}
        </div>
        <div className="hq-status" aria-live="polite">{busy ? 'Working…' : notice || (save ? `Local save · revision ${save.revision}` : stored ? '' : error ? '' : 'Opening local saves…')}</div>
        {error && <p className="hq-alert" role="alert">{error}</p>}
        {next && <div className="mission-route-note">
          <strong>{requested === 'moon' ? 'Lunar Reconnaissance' : 'Earth Observation'}</strong>
          <p>{next.detail}</p>{save && !next.href.startsWith('?mode=headquarters') && <a className="mission-button" href={next.href}>{next.label}</a>}
        </div>}
        {save && <AgencyWorkspace key={save.id} save={save} busy={busy} dispatch={dispatch} />}
        {stored && !save && !damaged &&
          <section className="hq-panel hq-create">
            <h2>Agency registration</h2>
            <p>Start with an illustrative {usd(startingGrantCents)} grant. Your agency is saved in this browser.</p>
            <form onSubmit={create}><label htmlFor="agency-name">Agency name</label>
              <input id="agency-name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={60} />
              <button className="hq-primary" disabled={busy}>Create agency</button>
            </form>
          </section>}
        {damaged && <section className="hq-panel">
          <h2>Save recovery</h2>
          <p>The active save could not be opened. Download its raw contents before recovery. Replacement requires an explicit action.</p>
          <div className="hq-actions">
            <button onClick={() => download(stored.raw ?? '', 'mission-control-unreadable.json')}>Download unreadable save</button>
            {backup && <button disabled={busy} onClick={() => void act(() => install({ ...backup, id: crypto.randomUUID(), revision: 0 }, 'replace'))}>Restore previous revision</button>}
          </div>
        </section>}
        <section className="hq-panel hq-saves" aria-labelledby="save-title">
          <div><h2 id="save-title">Agency saves</h2><p>Saves are local to this browser and address. Export a backup before clearing browser data.</p></div>
          <div className="hq-actions">
            <button disabled={busy} onClick={() => void act(reload)}>Reload local save</button>
            {save && <button disabled={busy} onClick={() => download(encodeSave(save), 'mission-control-agency.json')}>Export save</button>}
            <label htmlFor="agency-import">Import save</label>
            <input id="agency-import" type="file" accept=".json,application/json" disabled={!stored || busy} onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setCandidate(null)
              setRestoringArchive(false)
              void act(async () => {
                if (file.size > maxSaveSize) throw new Error('Save file is too large.')
                setCandidate(decodeSave(await file.text()))
              })
            }} />
          </div>
          {stored && stored.archives.length > 0 && <details className="hq-detail">
            <summary>Archived agency saves ({stored.archives.length})</summary>
            <ul>{stored.archives.map(({ key, raw }) => {
              const archive = readBackup(raw)
              return <li key={key}>
                <strong>{archive ? `${archive.agency.name} · Day ${archive.agency.day} · Revision ${archive.revision}` : 'Unreadable archived save'}</strong>
                <div className="hq-actions">
                  <button disabled={busy} onClick={() => download(raw, `mission-control-${key.replace(':', '-')}.json`)}>Export archived save</button>
                  {archive && <button disabled={busy} onClick={() => { setCandidate(archive); setRestoringArchive(true) }}>Restore archived save</button>}
                </div>
              </li>
            })}</ul>
          </details>}
          {candidate && <div className="hq-import-review">
            <p>{restoringArchive ? 'Restore' : 'Import'} <strong>{candidate.agency.name}</strong>, program day {candidate.agency.day}? {stored?.raw !== undefined && 'The current save will be archived on this device.'}</p>
            <button className="hq-primary" disabled={busy} onClick={() => void act(() => install({ ...candidate, id: crypto.randomUUID(), revision: 0 }, 'replace'))}>
              {restoringArchive ? 'Confirm archive restore' : stored?.raw !== undefined ? 'Archive current and import' : 'Import agency'}
            </button>{' '}
            <button onClick={() => setCandidate(null)}>Cancel import</button>
          </div>}
        </section>
      </main>
      <footer className="hq-footer"><div className="hq-shell">Independent educational project · Illustrative financial and scenario assumptions</div></footer>
    </div>
  )
}

function AgencyWorkspace({ save, busy, dispatch }: { save: Save; busy: boolean; dispatch: (intent: Intent) => void }) {
  const { agency } = save
  const [payload, setPayload] = useState<PayloadId>(agency.review?.payload ?? 'visible')
  const [axisM, setAxis] = useState<TrainingOrbitM>(agency.review?.axisM ?? 7_500_000)
  const funding = finances(agency.ledger)
  const assessment = assessTraining(payload, axisM)
  const forecast = agency.mission === 'accepted' && agency.review ? agency.review : assessment
  const researchState = agency.research

  return (
    <>
      <section className="hq-funding hq-panel" aria-labelledby="funding-title">
        <div className="hq-section-heading"><h2 id="funding-title">Funding overview</h2><span>Illustrative USD</span></div>
        <dl className="hq-balances">
          <div><dt>Cash balance</dt><dd>{usd(funding.cash)}</dd></div>
          <div><dt>Committed</dt><dd>{usd(funding.committed)}</dd></div>
          <div className="hq-available"><dt>Available cash</dt><dd>{usd(funding.available)}</dd></div>
          <div><dt>Paid expenses</dt><dd>{usd(funding.paid)}</dd></div>
        </dl>
      </section>
      <div className="hq-grid">
        <section className="hq-panel">
          <div className="hq-section-heading"><p className="hq-kicker">Mission portfolio</p><span className="hq-tag">{agency.mission}</span></div>
          <h2>{training.title}</h2>
          <p>{training.user} · {training.deliverable}</p>
          <details className="hq-detail"><summary>Projected cost · {usd(trainingEstimateCents)}</summary>
            <ul>{training.budgetLines.map(([label, cents]) => <li key={label}>{label} <strong>{usd(cents)}</strong></li>)}</ul>
            <p>The funding commitment is {usd(trainingCommitmentCents)} with {training.reservePercent}% contingency. Acceptance pays the estimate, releases unused contingency and posts a fictional {usd(training.completionGrantCents)} grant.</p>
          </details>
          {agency.mission === 'available' && <button className="hq-primary" disabled={busy || funding.available < trainingCommitmentCents} onClick={() => dispatch({ kind: 'fund-training' })}>Commit {usd(trainingCommitmentCents)}</button>}
          <div className="hq-review">
            <h3>Concept acceptance</h3>
            <p className="hq-small">Review the payload bands and orbital period before funding or submission.</p>
            <div className="hq-fields">
              <label>Payload<select value={forecast.payload} disabled={agency.mission === 'accepted'} onChange={event => setPayload(event.target.value === 'visible' ? 'visible' : 'multispectral')}>
                {Object.entries(payloads).map(([id, part]) => <option key={id} value={id}>{part.label}</option>)}
              </select></label>
              <label>Circular orbit<select value={forecast.axisM} disabled={agency.mission === 'accepted'} onChange={event => setAxis(event.target.value === '7000000' ? 7_000_000 : 7_500_000)}>
                <option value={7_000_000}>629 km altitude</option><option value={7_500_000}>1,129 km altitude</option>
              </select></label>
            </div>
            <ul className="hq-checks">
              <li><span>Cover Landsat reference bands</span><strong className={forecast.missingBands.length ? 'hq-warn' : 'hq-good'}>{forecast.missingBands.length ? `Missing ${forecast.missingBands.join(', ')}` : 'Coverage met'}</strong></li>
              <li><span>Period ≤ {training.maximumPeriodS.toLocaleString('en-US')} s</span><strong className={forecast.meetsPeriod ? 'hq-good' : 'hq-warn'}>{forecast.periodS.toFixed(2)} s · {forecast.meetsPeriod ? 'Met' : 'Missed'}</strong></li>
            </ul>
            <details className="hq-detail"><summary>Calculation and source evidence</summary>
              <p>Derived in {forecast.frame} at epoch {forecast.epochTdbSeconds} s TDB since J2000. T = 2π√(a³/μ), using a = {forecast.axisM.toLocaleString('en-US')} m and μ = {earthGravity.muM3PerS2.toExponential(11)} m³/s². The Earth radius and period limit are scenario assumptions.</p>
              <p>Published band intervals in µm. {training.requiredBands.map(band => `${band.label} ${band.publishedUm.join('–')}`).join(' · ')}. Catalog response intervals and the comparison rule are illustrative.</p>
              <ul>{Object.values(sources).filter(source => forecast.sourceIds.some(id => id === source.id)).map(source =>
                <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.locator} · {source.revision}</li>)}</ul>
              <p>Two-body solver {orbitModel.status} · {forecast.modelRevision} · {forecast.registryRevision}. This concept review checks coverage and period. Imagery and ground contact are outside this phase.</p>
            </details>
            {agency.mission === 'funded' && <button className="hq-primary" disabled={busy} onClick={() => dispatch({ kind: 'submit-review', payload, axisM })}>Submit training review</button>}
            {agency.review && <p className={agency.review.accepted ? 'hq-good' : 'hq-warn'} role="status">{agency.review.accepted ? 'Review accepted. Settlement posted.' : 'Last review missed at least one requirement. Revise the concept and submit again.'}</p>}
          </div>
        </section>
        <section className="hq-panel">
          <div className="hq-section-heading"><p className="hq-kicker">Engineering research</p><span className="hq-tag">{researchState.status}</span></div>
          <h2>{research.name}</h2>
          <p>Unlock eligibility for a fine-pointing attitude-control module in the agency’s capability register.</p>
          <dl className="hq-key-values"><div><dt>Projected cost</dt><dd>{usd(research.costCents)}</dd></div><div><dt>Duration</dt><dd>{research.durationDays} program days</dd></div><div><dt>Prerequisite</dt><dd>{research.prerequisite}</dd></div></dl>
          {researchState.status === 'available' && <>
            <button className="hq-primary" disabled={busy || agency.mission !== 'accepted' || funding.available < research.costCents} onClick={() => dispatch({ kind: 'start-research' })}>Fund research</button>
            {agency.mission !== 'accepted' && <p className="hq-small">Available after the training review is accepted.</p>}
          </>}
          {researchState.status === 'scheduled' && <p className="hq-warn">Committed · completes on day {researchState.readyDay}</p>}
          {unlockedCapabilities(agency).includes(research.capabilityId) && <p className="hq-good">Unlocked · {research.capability}</p>}
        </section>
      </div>
      {researchState.status === 'complete' && <section className="hq-panel" aria-labelledby="lunar-program-title">
        <h2 id="lunar-program-title">Lunar reconnaissance program</h2>
        <p>Pointing stability research unlocks a one-time illustrative program grant of {usd(lunarGrantCents)}. Mission approval still requires a feasible forecast and available cash.</p>
        <div className="hq-actions">
          {lunarGrantClaimed(agency) ? <span>Program grant received</span> :
            <button disabled={busy} onClick={() => dispatch({ kind: 'claim-lunar-grant' })}>Claim lunar program grant</button>}
          <a className="hq-nav-link" href="?mode=planning&amp;body=moon">Plan lunar reconnaissance</a>
        </div>
      </section>}
      <section className="hq-panel hq-ledger" aria-labelledby="ledger-title">
        <div className="hq-section-heading"><h2 id="ledger-title">Financial ledger</h2><span>Illustrative USD · newest first</span></div>
        <div className="hq-table-scroll" tabIndex={0} role="region" aria-label="Ledger transactions">
          <table><thead><tr><th scope="col">Day</th><th scope="col">Entry</th><th scope="col">Type</th><th scope="col">Amount</th></tr></thead>
            <tbody>{[...agency.ledger].reverse().map(line => <tr key={line.id}><td>{line.day}</td><th scope="row">{line.label}</th><td>{line.kind}</td><td>{usd(line.cents)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  )
}
