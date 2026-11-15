import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { unlockedCapabilities } from '../agency.ts'
import { readLocal, writeLocal } from '../localSaves.ts'
import { decodeSave } from '../saveFormat.ts'
import type { Save } from '../saveFormat.ts'
import { plannerHref } from '../missionEntry.ts'
import { assemblySources, catalog, catalogRevision, launchDimensionsM, launchEnvelope, partDefinition } from './catalog.ts'
import type { PartId } from './catalog.ts'
import { engineering, freeMounts, historyOf, initialAssembly, recordRevision, resolveAssembly, revise, travel } from './engine.ts'
import type { Edit, History, ResolvedPart } from './engine.ts'
import { twists } from './geometry.ts'
import type { Twist } from './geometry.ts'
import './workspace.css'

const Viewport = lazy(() => import('./Viewport.tsx'))
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const format = (value: number) => value.toFixed(3)
const formatVector = (values: readonly number[]) => values.map(format).join(' / ')
const availableParts = (Object.keys(catalog) as PartId[]).filter((id): id is Exclude<PartId, 'bus'> => id !== 'bus')

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The workspace could not complete the action.'
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p className="assembly-canvas-fallback">3D is unavailable. Continue with the assembly tree and mount controls.</p> : this.props.children
  }
}

export default function AssemblyWorkspace() {
  const [data, setData] = useState<{ raw: string; save: Save } | null>(null)
  const [status, setStatus] = useState('Loading agency…')
  useEffect(() => {
    let active = true
    readLocal().then(({ raw }) => {
      if (!active) return
      if (raw === undefined) setStatus('Create or import an agency at headquarters first.')
      else setData({ raw, save: decodeSave(raw) })
    }).catch(error => { if (active) setStatus(message(error)) })
    return () => { active = false }
  }, [])
  if (!data) return <main className="assembly-loading"><h1>Vehicle Assembly</h1><p role="status">{status}</p><a href="?mode=headquarters">Agency headquarters</a></main>
  return <Workbench initial={data} />
}

function Workbench({ initial }: { initial: { raw: string; save: Save } }) {
  const [stored, setStored] = useState(initial)
  const [history, setHistory] = useState<History>(() => historyOf(initial.save.assembly ?? initialAssembly))
  const [selection, setSelection] = useState('bus')
  const [search, setSearch] = useState('')
  const [partId, setPartId] = useState<Exclude<PartId, 'bus'>>('imager')
  const [reuse, setReuse] = useState<string | null>(null)
  const [mountKey, setMountKey] = useState('')
  const [twist, setTwist] = useState<Twist>(0)
  const [fit, setFit] = useState(0)
  const [overlay, setOverlay] = useState(false)
  const [showAxes, setShowAxes] = useState(false)
  const [use3d, setUse3d] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const saving = useRef(false)
  const assembly = history.present
  const dirty = assembly !== (stored.save.assembly ?? initialAssembly)
  const capabilities = useMemo(() => unlockedCapabilities(stored.save.agency), [stored.save.agency])
  const report = useMemo(() => engineering(assembly), [assembly])
  const resolved = useMemo(() => resolveAssembly(assembly), [assembly])
  const selected = resolved.find(part => part.id === selection)
  const joint = assembly.joints.find(item => item.child === selection)
  const draftPart = partDefinition(partId)
  const locked = draftPart.capability !== undefined && !capabilities.includes(draftPart.capability)
  const mounts = locked ? [] : freeMounts(assembly, resolved, partId, twist)
  const mount = mounts.find(item => item.key === mountKey)
  const source = assemblySources[partDefinition(selected?.part ?? partId).source]
  const launchBlocked = !report.fitsEnvelope || !report.fitsMass || !report.fitsCom
  const route = new URLSearchParams(location.search).get('next')

  useEffect(() => {
    if (!dirty) return
    function protect(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = true }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  function placement(id: string): Edit | undefined {
    if (!mount) return undefined
    const joint = { parent: mount.parent, host: mount.host, twist, id }
    return reuse ? { ...joint, kind: 'attach' } : { ...joint, kind: 'install', part: partId }
  }

  let preview: ResolvedPart | undefined
  let previewError = ''
  if (mount) {
    let id = 'preview'
    while (assembly.parts.some(part => part.id === id)) id += '-p'
    const edit = placement(reuse ?? id)
    try {
      if (edit) preview = resolveAssembly(revise(assembly, edit, capabilities)).find(part => part.id === edit.id)
    } catch (error) { previewError = message(error) }
  }

  function edit(edit: Edit) {
    try {
      setHistory(recordRevision(history, revise(assembly, edit, capabilities)))
      setSelection(edit.kind === 'remove' ? 'bus' : edit.id)
      if (edit.kind === 'install' || edit.kind === 'attach') {
        setMountKey('')
        setReuse(null)
      }
      setNotice('')
      setError('')
    } catch (reason) { setError(message(reason)) }
  }

  function choosePart(part: Exclude<PartId, 'bus'>) {
    setPartId(part)
    setReuse(null)
    setMountKey('')
    setTwist(0)
  }

  function undoOrRedo(direction: 'undo' | 'redo') {
    const next = travel(history, direction)
    setHistory(next)
    if (!next.present.parts.some(part => part.id === selection)) setSelection('bus')
    setReuse(null)
    setMountKey('')
    setError('')
    setNotice('')
  }

  async function saveDraft() {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const save = { ...stored.save, revision: stored.save.revision + 1, assembly }
      const raw = await writeLocal(stored.raw, save)
      setStored({ raw, save })
      setNotice(`Assembly revision ${assembly.revision} saved on this device.`)
      return true
    } catch (reason) { setError(message(reason)) }
    finally { saving.current = false; setBusy(false) }
  }

  return (
    <div className="assembly-workspace">
      <a className="skip-link" href="#assembly-tree">Skip to assembly tree</a>
      <header className="assembly-header">
        <div><a href="?" onClick={async event => {
          if (!dirty || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          if (await saveDraft()) location.assign('?')
        }}>{dirty ? 'Save draft and return to Missions' : 'Back to Missions'}</a><h1>Vehicle Assembly</h1></div>
        <div className="assembly-header-actions">
          <a href={plannerHref(route === 'moon' || route === 'wildfire' ? route : 'earth')}>Mission Planning</a>
          <span>{stored.save.agency.name} · Revision {assembly.revision}{dirty ? ' · Unsaved' : ''}</span>
          <button className="assembly-primary" disabled={!dirty || busy} aria-describedby="assembly-save-help" onClick={() => void saveDraft()}>{busy ? 'Saving…' : 'Save draft'}</button>
          <span id="assembly-save-help">{busy ? 'Writing local save.' : dirty ? 'Save changes before planning.' : 'No unsaved changes.'}</span>
        </div>
      </header>
      <p className="assembly-announcement" role="status">{notice || 'Orbital survey spacecraft · Select a subsystem, choose a highlighted mount and save the draft.'}</p>
      {error && <p className="assembly-error" role="alert">{error}</p>}
      <main className="assembly-columns">
        <aside className="assembly-panel assembly-parts" aria-label="Assembly tools">
          <h2>Component catalog</h2>
          <label className="assembly-field">Search components<input type="search" value={search}
            onChange={event => setSearch(event.target.value)} placeholder="Name or subsystem" /></label>
          <div className="assembly-catalog">
            {availableParts.filter(id => {
              const spec = partDefinition(id)
              return `${spec.name} ${spec.description}`.toLowerCase().includes(search.trim().toLowerCase())
            }).map(id => {
              const spec = partDefinition(id)
              const researchLocked = spec.capability !== undefined && !capabilities.includes(spec.capability)
              return <button key={id} aria-pressed={partId === id && !reuse} onClick={() => choosePart(id)}>
                <i style={{ background: spec.color }} aria-hidden="true" />
                <span>{spec.name}<small>{researchLocked ? 'Research required' : `${format(spec.massKg)} kg`}</small></span>
              </button>
            })}
            {search.trim() && !availableParts.some(id => {
              const spec = partDefinition(id)
              return `${spec.name} ${spec.description}`.toLowerCase().includes(search.trim().toLowerCase())
            }) && <p>No components match.</p>}
          </div>
          <section id="assembly-tree" tabIndex={-1} className="assembly-tree">
            <h2>Assembly tree</h2>
            <ul>{resolved.filter(part => part.mounted).map(part => {
              const link = assembly.joints.find(item => item.child === part.id)
              return <li key={part.id}><button aria-pressed={selection === part.id} onClick={() => setSelection(part.id)}>
                {partDefinition(part.part).name}<small>{link ? `Mounted on ${link.parent}/${link.host}` : 'Root · Fixed'}</small>
              </button></li>
            })}</ul>
            {resolved.some(part => !part.mounted) && <><h3>Detached inventory</h3><ul>{resolved.filter(part => !part.mounted).map(part =>
              <li key={part.id}><button aria-pressed={selection === part.id} onClick={() => setSelection(part.id)}>
                {partDefinition(part.part).name}<small>{assembly.joints.some(item => item.child === part.id) ? 'In detached subassembly' : 'Detached root'}</small>
              </button></li>)}</ul></>}
          </section>
        </aside>
        <section className="assembly-panel assembly-center" aria-labelledby="viewport-title">
          <div className="assembly-viewport-heading"><h2 id="viewport-title">Stowed configuration</h2>
            <button onClick={() => setUse3d(!use3d)} aria-pressed={use3d}>3D view</button></div>
          <div className="assembly-canvas" data-testid="assembly-viewport">
            {use3d ? <ViewBoundary><Suspense fallback={<p className="assembly-canvas-fallback">Loading spacecraft viewport…</p>}>
              <Viewport parts={report.parts} preview={preview} selected={selection} choose={setSelection}
                markers={mounts.map(point => ({ key: point.key, position: point.position, active: point.key === mountKey }))}
                chooseMount={setMountKey} com={report.comM} overlay={overlay} showAxes={showAxes}
                fit={fit} bounds={report.bounds} blocked={Boolean(previewError)} launchBlocked={launchBlocked} onLost={() => setUse3d(false)} />
            </Suspense></ViewBoundary> : <p className="assembly-canvas-fallback">Assembly tree mode. Component selection and mounting remain available.</p>}
          </div>
          <div className="assembly-toolbar">
            {use3d && <>
              <button onClick={() => setFit(fit + 1)}>Fit spacecraft</button>
              <label><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)} /> Launch envelope</label>
              <label><input type="checkbox" checked={showAxes} onChange={event => setShowAxes(event.target.checked)} /> Axes</label>
            </>}
            <button disabled={!history.past.length} aria-describedby={!history.past.length ? 'undo-help' : undefined} onClick={() => undoOrRedo('undo')}>Undo</button>
            <button disabled={!history.future.length} aria-describedby={!history.future.length ? 'redo-help' : undefined} onClick={() => undoOrRedo('redo')}>Redo</button>
            {(!history.past.length || !history.future.length) && <p className="assembly-eyeline">
              {!history.past.length && <span id="undo-help">No change to undo. </span>}
              {!history.future.length && <span id="redo-help">No change to redo.</span>}
            </p>}
          </div>
          <p className="assembly-view-guide">Launch view uses stowed dimensions. In flight, solar generation uses the mounted panel’s modeled output in sunlight. Deployment geometry and animation are outside the model.</p>
          {use3d && <p className="assembly-view-guide">Select a part to inspect it. Drag to orbit and scroll or pinch to zoom. Amber marks center of mass or an invalid placement.</p>}
          <section className="assembly-placement" aria-label="Component placement">
            <h2>{reuse ? 'Reattach' : 'Place'} {draftPart.name}</h2>
            <p>{draftPart.description}</p>
            <p>{format(draftPart.massKg)} kg · {money.format(draftPart.costCents / 100)} · {formatVector(draftPart.sizeM)} m local X / Y / Z
              {draftPart.generationW > 0 && ` · ${draftPart.generationW} W nominal generation`}
              {draftPart.capacityJ > 0 && ` · ${draftPart.capacityJ.toLocaleString('en-US')} J usable`}
              {draftPart.loadW > 0 && ` · ${draftPart.loadW} W peak draw`}</p>
            {locked ? <p className="assembly-warning">Complete pointing stability research to use this component.</p> : <>
              <div className="assembly-placement-fields">
                <label className="assembly-field">Attachment node<select value={mount?.key ?? ''} onChange={event => setMountKey(event.target.value)}>
                  <option value="">Choose a compatible mount</option>{mounts.map(point => <option key={point.key} value={point.key}>{point.label}</option>)}
                </select></label>
                <label className="assembly-field">Mount rotation<select value={twist} onChange={event => {
                  const value = twists.find(angle => angle === Number(event.target.value))
                  if (value !== undefined) setTwist(value)
                }}>{twists.map(angle => <option key={angle} value={angle}>{angle}°</option>)}</select></label>
              </div>
              {!preview && <p id="placement-help" className={previewError ? 'assembly-error' : 'assembly-warning'} role={previewError ? 'status' : undefined}>
                {previewError || (!mounts.length ? 'No free compatible node. Select another part or detach the occupant.' : 'Choose a compatible attachment node to preview and attach.')}
              </p>}
              <button className="assembly-primary" disabled={!preview} aria-describedby={!preview ? 'placement-help' : undefined} onClick={() => {
                const intent = placement(reuse ?? crypto.randomUUID())
                if (intent) edit(intent)
              }}>Attach component</button>
            </>}
          </section>
        </section>
        <aside className="assembly-panel assembly-inspector" aria-label="Engineering inspector">
          <h2>Engineering inspector</h2>
          <p className="assembly-eyeline">Calculated from mounted parts</p>
          <dl className="assembly-metrics" aria-live="polite">
            <div><dt>Dry mass</dt><dd>{format(report.dryKg)} kg</dd></div>
            <div><dt>Wet mass</dt><dd>{format(report.wetKg)} kg</dd></div>
            <div><dt>Center of mass · X / Y / Z</dt><dd>{formatVector(report.comM)} m</dd></div>
            <div><dt>Bounds · X / Y / Z</dt><dd>{formatVector(report.dimensionsM)} m</dd></div>
            <div><dt>Procurement estimate</dt><dd>{money.format(report.costCents / 100)}</dd></div>
            <div><dt>Nominal solar / peak load</dt><dd>{report.generationW} / {report.peakLoadW} W</dd></div>
            <div><dt>Usable storage</dt><dd>{report.capacityJ.toLocaleString('en-US')} J</dd></div>
          </dl>
          <section className="assembly-validation">
            <h3>{launchEnvelope.label}</h3>
            <strong className={launchBlocked ? 'assembly-warning' : 'assembly-good'}>{launchBlocked ? 'Launch fit blocked' : 'Stowed fit, mass and CoM pass'}</strong>
            <p>{launchDimensionsM.map(format).join(' × ')} m stowed · {launchEnvelope.maxWetKg} kg wet limit</p>
            <p>Maximum CoM offset · {formatVector(launchEnvelope.maxComOffsetM)} m (X / Y / Z)</p>
            <ul>{report.warnings.map(warning => <li key={`${warning.part}-${warning.message}`}>
              {warning.part ? <button className="assembly-link" onClick={() => setSelection(warning.part!)}>{warning.message}</button> : warning.message}
            </li>)}</ul>
          </section>
          {selected && <section className="assembly-selection">
            <p className="assembly-eyeline">Selected component</p><h3>{partDefinition(selected.part).name}</h3>
            <p>{partDefinition(selected.part).description}</p>
            <p>{selected.mounted ? `Position (m) · ${formatVector(selected.pose.positionM)}` : 'Detached from spacecraft'}</p>
            {selected.mounted && <details><summary>Orientation · local axes in bus coordinates</summary>
              <p>{selected.pose.axes.map((axis, index) => `${'XYZ'[index]} [${axis.join(', ')}]`).join(' · ')}</p>
            </details>}
            {joint && <button onClick={() => edit({ kind: 'rotate', id: selected.id, twist: twists[(twists.indexOf(joint.twist) + 1) % twists.length] })}>Rotate +90°</button>}
            {selected.mounted && joint && <button onClick={() => edit({ kind: 'detach', id: selected.id })}>Detach</button>}
            {!selected.mounted && !joint && selected.part !== 'bus' && <button onClick={() => {
              if (selected.part === 'bus') return
              choosePart(selected.part)
              setReuse(selected.id)
            }}>Place detached part</button>}
            {selected.id !== 'bus' && <button onClick={() => edit({ kind: 'remove', id: selected.id })} title="Removes this part and its dependent parts">Remove</button>}
          </section>}
          <details className="assembly-provenance"><summary>Sources & model scope</summary>
            <p>Assembly arithmetic and rigid box geometry · TESTED · {catalogRevision}. Part specs, USD values, mount interfaces and launch limits are illustrative.</p>
            <p>Dry and wet mass are equal for this catalog. Propulsion and propellant are outside this phase. Solar values sum nominal individual outputs; attitude, eclipses and shadowing are outside this estimate.</p>
            <p>Selected part guidance · <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.locator}</p>
            <p>Launch checks follow spacecraft-specific interface review principles. <a href={assemblySources.interface.url} target="_blank" rel="noreferrer">{assemblySources.interface.title}</a></p>
          </details>
        </aside>
      </main>
    </div>
  )
}
