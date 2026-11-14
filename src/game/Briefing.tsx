import { missionObjectives, orbitOptions, simulationRules } from '../simulation/catalog.ts'
import type { ObjectiveId } from '../simulation/catalog.ts'
import { Icon, OrbitGraphic } from './Visuals.tsx'

const missionDescriptions = {
  coastal: 'Return visible-light images of a flooded coast for an emergency mapping team.',
  crop: 'Return red and near-infrared images of farmland for an agriculture team.',
}

interface BriefingProps {
  objective: ObjectiveId
  choose: (objective: ObjectiveId) => void
  start: () => void
}

export function Briefing({ objective, choose, start }: BriefingProps) {
  return (
    <div className="briefing">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Mission briefing</p>
          <h1>Design a mission.<br /><em>Bring back science.</em></h1>
          <p className="lede">You’re the mission director. Build a 3U CubeSat, choose its orbit, and see whether your design gets usable images back to Earth.</p>
          <dl className="brief-specs">
            <div><dt>Mission budget</dt><dd>{missionObjectives[objective].budgetCredits} <small>credits</small></dd></div>
            <div><dt>Launch mass limit</dt><dd>{Object.values(orbitOptions).map(offer => (offer.massLimitGrams / 1000).toFixed(1)).join('–')} <small>kg</small></dd></div>
            <div><dt>Simulated mission</dt><dd>{simulationRules.orbitCount} <small>orbits</small></dd></div>
          </dl>
        </div>
        <figure className="hero-visual">
          <OrbitGraphic />
          <figcaption><Icon name="orbit" /> Low Earth orbit <span>Illustrative view</span></figcaption>
        </figure>
      </div>
      <fieldset className="objective-field">
        <legend>Choose your science objective</legend>
        <div className="objective-grid">
          {(['coastal', 'crop'] as const).map(id => {
            const mission = missionObjectives[id]
            return (
              <label className="choice objective-card" key={id}>
                <input type="radio" name="objective" checked={objective === id} onChange={() => choose(id)} />
                <span className="objective-icon"><Icon name={id === 'coastal' ? 'coast' : 'crop'} /></span>
                <span className="objective-copy"><strong>{mission.name}</strong><span>{missionDescriptions[id]}</span></span>
                <span className="scene-target">{mission.targetScenes} scenes</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="action-row">
        <p>A successful mission meets its scene target and keeps the spacecraft powered through every orbit.</p>
        <button className="button primary" onClick={start}>Start Designing <Icon name="arrow" /></button>
      </div>
    </div>
  )
}
