import { useEffect, useState } from 'react'
import { readLocal } from './localSaves.ts'
import { decodeSave } from './saveFormat.ts'
import type { Save } from './saveFormat.ts'
import { missionEntry } from './missionEntry.ts'
import type { Destination } from './missionEntry.ts'
import './headquarters.css'

const destinations = [
  { id: 'earth', name: 'Earth Observation', difficulty: 'Independent mission', task: 'Build a spacecraft and choose its orbit, launch service, and when to image or transmit. Compare how your choices affect science and cost.',
    source: 'https://science.nasa.gov/resource/blue-marble-2002/', credit: 'NASA Earth Observatory' },
  { id: 'moon', name: 'Lunar Reconnaissance', difficulty: 'Advanced · Research required', task: 'Start in lunar orbit, collect repeat optical scenes and compare evidence from candidate surface sites.',
    source: 'https://science.nasa.gov/resource/lunar-near-side-2/', credit: 'NASA / GSFC / ASU' },
] as const

export function MissionHome() {
  const [state, setState] = useState<{ save: Save | null; error?: string } | null>(null)
  useEffect(() => {
    let active = true
    readLocal().then(({ raw }) => { if (active) setState({ save: raw ? decodeSave(raw) : null }) })
      .catch(() => { if (active) setState({ save: null, error: 'Open Headquarters to recover or inspect your local save.' }) })
    return () => { active = false }
  }, [])
  function activeFlight(id: Destination) {
    return state?.save?.missions?.findLast(mission => id === 'moon' ? mission.schemaVersion === 3 :
      mission.schemaVersion === 2 && (id === 'wildfire' ? mission.plan.objective === 'wildfire' : mission.plan.objective !== 'wildfire'))
  }
  return <div className="hq mission-home">
    <a className="skip-link" href="#mission-deck">Skip to missions</a>
    <header className="hq-top"><div className="hq-shell hq-top-inner">
      <a className="hq-brand" href="?">MISSION CONTROL</a>
      <nav className="hq-actions" aria-label="Workspaces">
        {state?.save?.missions?.length ? <a href="?mode=operations">Flight records</a> : null}
        <a href="?mode=headquarters">Agency headquarters</a>
      </nav>
    </div></header>
    <main className="hq-shell mission-deck" id="mission-deck" tabIndex={-1}>
      <section className="mission-intro">
        <div><p className="hq-kicker">Earth and Moon flight simulator</p>
          <h1>Choose your mission.</h1>
          <p>Assemble a spacecraft, plan the orbit and bring science home.</p></div>
        <div className="mission-demo">
          <a className="mission-button primary" href="?mode=demo">Start guided tutorial <span aria-hidden="true">↗</span></a>
          <p>Learn to image Sacramento Valley and send a scene home. Progress stays in this tab.</p>
        </div>
      </section>
      {state?.error && <p role="status">{state.error}</p>}
      <section className="mission-destinations" aria-label="Available missions">
        {destinations.map(item => {
          const entry = missionEntry(item.id, state?.save ?? null)
          const flight = activeFlight(item.id)
          const wildfire = item.id === 'earth' && state ? missionEntry('wildfire', state.save) : null
          const wildfireFlight = wildfire && activeFlight('wildfire')
          return <article className="mission-destination" key={item.id}>
            <div className={`mission-art ${item.id}`}>
              <img src={`${import.meta.env.BASE_URL}mission/${item.id}.jpg`} alt="" width="768" height="768" />
              <a href={item.source} target="_blank" rel="noreferrer">{item.credit}</a>
            </div>
            <div className="mission-details">
              <p className="hq-kicker">{item.difficulty}</p>
              <h2>{item.name}</h2><p>{item.task}</p>
              {state ? <p className="mission-prerequisite">{entry.detail}</p> : <p className="mission-prerequisite" role="status">Checking local progress…</p>}
              <div className="mission-links">
                {state && <a className="mission-button" href={entry.href}>{entry.label}</a>}
                {flight && <a href={`?mode=operations&mission=${flight.id}`}>Open latest flight</a>}
              </div>
              {wildfire && <section className="mission-wildfire" aria-label="California Wildfire Observation">
                <h3>California Wildfire Observation</h3>
                <p>Return one visible-red scene of the Paradise area within six simulated hours.</p>
                <div className="mission-links"><a href={wildfire.href}>Start wildfire planning</a>
                  {wildfireFlight && <a href={`?mode=operations&mission=${wildfireFlight.id}`}>Open wildfire flight</a>}</div>
              </section>}
            </div>
          </article>
        })}
      </section>
      <footer className="mission-footer"><span>Educational simulation · Orbital mechanics tested · Mission conditions illustrative</span><a href="?mode=tutorial">Classic CubeSat tutorial</a></footer>
    </main>
  </div>
}
