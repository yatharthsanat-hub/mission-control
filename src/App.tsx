import { useEffect, useRef, useState } from 'react'
import type { ObjectiveId, SpacecraftConfiguration } from './simulation/catalog.ts'
import { simulateMission } from './simulation/simulate.ts'
import type { CompletedMission } from './simulation/simulate.ts'
import { Briefing } from './game/Briefing.tsx'
import { Designer } from './game/Designer.tsx'
import { Operations } from './game/Operations.tsx'
import { Results } from './game/Results.tsx'
import { Icon } from './game/Visuals.tsx'
import './App.css'

const stages = ['Briefing', 'Design', 'Operations', 'Results'] as const
type Stage = (typeof stages)[number]

const initialDesign: SpacecraftConfiguration = {
  objective: 'coastal',
  orbit: 'midInclination',
  imager: 'visible',
  solarArray: 'bodyMounted',
  battery: 'compact',
  radio: 'lowRate',
  reservePercent: 15,
}

export default function App() {
  const [stage, setStage] = useState<Stage>('Briefing')
  const [draft, setDraft] = useState(initialDesign)
  const [run, setRun] = useState<CompletedMission | null>(null)
  const [previous, setPrevious] = useState<CompletedMission | null>(null)
  const main = useRef<HTMLElement>(null)
  const sources = useRef<HTMLDialogElement>(null)
  const lastStage = useRef(stage)
  const stageIndex = stages.indexOf(stage)

  useEffect(() => {
    if (lastStage.current === stage) return
    lastStage.current = stage
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [stage])

  function chooseObjective(objective: ObjectiveId) {
    if (objective === draft.objective) return
    setDraft({
      ...initialDesign,
      objective,
      imager: objective === 'coastal' ? 'visible' : 'redNir',
    })
    setPrevious(null)
    setRun(null)
  }

  function launch() {
    const result = simulateMission(draft)
    if (result.status === 'completed') {
      setRun(result)
      setStage('Operations')
    }
  }

  function redesign(completed: CompletedMission) {
    setPrevious(completed)
    setStage('Design')
  }

  return (
    <>
      <a href="#main" className="skip-link">Skip to mission</a>
      <header className="topbar">
        <div className="shell topbar-inner">
          <button className="wordmark" onClick={() => setStage('Briefing')} aria-label="MISSION CONTROL briefing">
            <span className="brand-mark"><Icon name="orbit" /></span>
            <span>MISSION<span className="brand-accent"> CONTROL</span></span>
          </button>
          <button className="text-button source-button" onClick={() => sources.current?.showModal()}>
            <Icon name="info" /> Sources &amp; assumptions
          </button>
        </div>
      </header>
      <div className="phase-bar">
        <nav className="shell" aria-label="Mission stages">
          <ol>
            {stages.map((item, index) => (
              <li key={item} aria-current={item === stage ? 'step' : undefined} className={index < stageIndex ? 'past-phase' : ''}>
                <span className="phase-index">0{index + 1}</span>{item}
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <main className="shell main-content" id="main" ref={main} tabIndex={-1} aria-label={stage}>
        {stage === 'Briefing' && <Briefing objective={draft.objective} choose={chooseObjective} start={() => setStage('Design')} />}
        {stage === 'Design' && <Designer draft={draft} onChange={setDraft} launch={launch} back={() => setStage('Briefing')} />}
        {stage === 'Operations' && run &&
          <Operations run={run} finish={() => setStage('Results')} edit={() => setStage('Design')} />}
        {stage === 'Results' && run &&
          <Results run={run} previous={previous} redesign={() => redesign(run)} briefing={() => { setPrevious(run); setStage('Briefing') }} />}
      </main>
      <footer className="footer">
        <div className="shell">
          <span>MISSION CONTROL</span>
          <span>Independent educational simulation · Illustrative mission data</span>
        </div>
      </footer>
      <dialog ref={sources} className="sources-dialog" aria-labelledby="sources-title">
        <form method="dialog"><button className="text-button dialog-close" aria-label="Close sources"><Icon name="close" /></button></form>
        <h2 id="sources-title">Sources &amp; assumptions</h2>
        <p>Part specifications, budgets, mass limits, orbital schedules, reserve policies and scores are illustrative game values. Each run starts fully charged, uses constant power loads within each five-minute step and assumes ideal battery efficiency. The orbit diagram is schematic.</p>
        <p>NASA references inform the engineering relationships and mission-planning approach. MISSION CONTROL is an independent educational project.</p>
        <ul>
          <li><a href="https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf" target="_blank" rel="noreferrer">Design and Develop Science Missions</a> informs the science-led briefing and measurable mission requirements.</li>
          <li><a href="https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf" target="_blank" rel="noreferrer">CubeSat 101</a> informs the CubeSat form factor, launch constraints and ground segment.</li>
          <li><a href="https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/" target="_blank" rel="noreferrer">Small Spacecraft Technology · Power</a> explains solar generation, eclipse and energy storage.</li>
          <li><a href="https://ntrs.nasa.gov/citations/20150007816" target="_blank" rel="noreferrer">Space Mission Concept Development Using Concept Maturity Levels</a> informs the redesign loop.</li>
          <li><a href="https://science.nasa.gov/mission/landsat-9/" target="_blank" rel="noreferrer">Landsat 9</a> is a real example of visible and near-infrared Earth imaging.</li>
        </ul>
      </dialog>
    </>
  )
}
