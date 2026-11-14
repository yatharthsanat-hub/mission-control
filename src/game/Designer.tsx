import {
  batteries, bus, imagers, missionObjectives, orbitOptions, radios, simulationRules, solarArrays,
} from '../simulation/catalog.ts'
import type { SpacecraftConfiguration } from '../simulation/catalog.ts'
import type { Imager } from '../simulation/types.ts'
import { validateLaunch } from '../simulation/launch.ts'
import { Icon } from './Visuals.tsx'

type Option<Key> = { id: Key; name: string; description: string; spec: string; warning?: string }

function PartOptions<Key extends string | number>({ label, help, options, value, select }: {
  label: string
  help: string
  options: readonly Option<Key>[]
  value: Key
  select: (value: Key) => void
}) {
  return (
    <fieldset className="parts-group">
      <legend>{label}</legend>
      <p className="group-help">{help}</p>
      <div className="parts-grid">
        {options.map(option => (
          <label className="choice part-card" key={option.id}>
            <input type="radio" name={label} checked={option.id === value} onChange={() => select(option.id)} />
            <span><strong>{option.name}</strong><span className="part-description">{option.description}</span><span className="part-spec">{option.spec}</span>
              {option.warning && <span className="part-warning">{option.warning}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function partCost(part: { massGrams: number; costCredits: number }) {
  return `${(part.massGrams / 1000).toFixed(2)} kg · ${part.costCredits} cr`
}

export function Designer({ draft, onChange, back, launch }: {
  draft: SpacecraftConfiguration
  onChange: (draft: SpacecraftConfiguration) => void
  back: () => void
  launch: () => void
}) {
  const mission = missionObjectives[draft.objective]
  const { resources, violations } = validateLaunch(draft)
  const canLaunch = resources !== null && violations.length === 0
  const stepMinutes = simulationRules.stepMinutes

  function change<Field extends keyof SpacecraftConfiguration>(field: Field, value: SpacecraftConfiguration[Field]) {
    onChange({ ...draft, [field]: value })
  }

  return (
    <div>
      <button className="text-button back-button" onClick={back}><Icon name="back" /> Mission briefing</button>
      <div className="page-heading">
        <p className="eyebrow">{mission.name}</p>
        <h1>Build your CubeSat.</h1>
        <p>Choose a rideshare and equip the spacecraft to return {mission.targetScenes} complete scenes while keeping it powered.</p>
      </div>
      <div className="work-grid">
        <div className="parts-list">
          <PartOptions label="Launch & orbit" help="The rideshare sets your mass limit, sunlight, target views, and ground station contacts."
            value={draft.orbit} select={value => change('orbit', value)}
            options={(['midInclination', 'nearPolar'] as const).map(id => {
              const orbit = orbitOptions[id]
              const views = orbit.observationSteps[draft.objective].length
              const contactMinutes = orbit.contactStepsByOrbit.reduce((sum, steps) => sum + steps.length, 0) * stepMinutes
              return {
                id, name: orbit.name,
                description: `${views} target ${views === 1 ? 'view' : 'views'} per orbit · ${contactMinutes} min total contact ${id === 'nearPolar' ? 'in eclipse' : 'in sunlight'}`,
                spec: `${(orbit.massLimitGrams / 1000).toFixed(2)} kg limit · ${orbit.launchCostCredits} cr · ${orbit.sunlightSteps * stepMinutes} min sun/orbit`,
              }
            })} />
          <PartOptions label="Imager" help="Match the instrument’s bands to the objective. Larger scenes take more storage and contact time."
            value={draft.imager} select={value => change('imager', value)}
            options={(['visible', 'redNir'] as const).map(id => {
              const imager: Imager = imagers[id]
              const missing = mission.requiredBands.filter(band => !imager.bands.includes(band))
              return {
                id, name: imager.name, description: imager.bands.join(', '),
                spec: `${partCost(imager)} · +${imager.activeWatts} W · ${imager.sceneMB} MB/scene`,
                warning: missing.length ? `Missing required bands · ${missing.join(', ')}` : undefined,
              }
            })} />
          <PartOptions label="Solar array" help="Panels supply power in sunlight. Extra output can recharge the battery sooner."
            value={draft.solarArray} select={value => change('solarArray', value)}
            options={(['bodyMounted', 'deployable'] as const).map(id => ({
              id, name: solarArrays[id].name,
              description: id === 'bodyMounted' ? 'Lower mass and cost, with less charging power.' : 'More charging power at a higher mass and cost.',
              spec: `${partCost(solarArrays[id])} · ${solarArrays[id].sunlightWatts} W in sun`,
            }))} />
          <PartOptions label="Battery" help="Stored energy runs the spacecraft in eclipse and covers shortfalls during imaging or downlink."
            value={draft.battery} select={value => change('battery', value)}
            options={(['compact', 'extended'] as const).map(id => ({
              id, name: batteries[id].name,
              description: id === 'compact' ? 'Leaves more room in the launch mass and budget.' : 'Carries more energy into eclipse and adds mass.',
              spec: `${partCost(batteries[id])} · ${batteries[id].capacityWh} Wh usable`,
            }))} />
          <PartOptions label="Radio" help="Ground contact limits when you can send data. Faster transmission clears storage sooner and draws more power."
            value={draft.radio} select={value => change('radio', value)}
            options={(['lowRate', 'highRate'] as const).map(id => ({
              id, name: radios[id].name,
              description: id === 'lowRate' ? 'Draws less power during a contact.' : 'Returns more data in the same contact window.',
              spec: `${partCost(radios[id])} · +${radios[id].activeWatts} W · ${radios[id].rateMBPerMinute} MB/min`,
            }))} />
          <PartOptions label="Battery reserve" help="Imaging and downlink must leave this much usable charge after each step. The spacecraft bus can draw below it."
            value={draft.reservePercent} select={value => change('reservePercent', value)}
            options={simulationRules.reservePercents.map((id, index) => ({
              id, name: `${id}% reserve`,
              description: index === 0 ? 'Allows more optional operations with less charge held back.' : 'Holds back more charge and may skip optional operations.',
              spec: `${(batteries[draft.battery].capacityWh * id / 100).toFixed(2)} Wh reserved`,
            }))} />
        </div>
        <aside className="panel flight-check" aria-labelledby="flight-title">
          <h2 id="flight-title">Flight readiness</h2>
          <p className="muted">Illustrative engineering estimates</p>
          {resources && (
            <div className="limit-list">
              <Limit label="Launch mass" value={resources.massGrams / 1000} max={resources.massLimitGrams / 1000} unit="kg" />
              <Limit label="Mission cost" value={resources.costCredits} max={resources.budgetCredits} unit="cr" />
            </div>
          )}
          <div className="bus-info">
            <strong>{bus.name}</strong>
            <p>{partCost(bus)} · {bus.housekeepingWatts} W housekeeping · {bus.storageMB} MB onboard</p>
          </div>
          <div className={canLaunch ? 'validation ready' : 'validation blocked'} aria-live="polite" aria-atomic="true">
            <strong><Icon name={canLaunch ? 'check' : 'warning'} />{canLaunch ? 'Cleared for simulation' : 'Launch blocked'}</strong>
            {violations.length > 0 && <ul id="launch-errors">{violations.map(violation => <li key={violation.message}>{violation.message}</li>)}</ul>}
          </div>
          <button className="button primary launch-button" onClick={launch} disabled={!canLaunch}
            aria-describedby={violations.length ? 'launch-errors' : undefined}>Launch Mission <Icon name="arrow" /></button>
        </aside>
      </div>
    </div>
  )
}

function Limit({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const format = (amount: number) => unit === 'kg' ? amount.toFixed(2) : amount
  return (
    <div className={value > max ? 'limit over-limit' : 'limit'}>
      <div><span>{label}</span><strong>{format(value)} / {format(max)} {unit}</strong></div>
      <meter min={0} max={max} value={Math.min(value, max)} aria-label={label} aria-valuetext={`${format(value)} of ${format(max)} ${unit}`} />
    </div>
  )
}
