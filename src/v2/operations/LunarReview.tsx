import { useMemo } from 'react'
import { lunarSites } from '../planning/lunarScenario.ts'
import type { LunarMission } from '../planning/mission.ts'
import type { Save } from '../saveFormat.ts'
import { assessLunarSite, readLunarSiteAssessment } from './lunarAssessment.ts'
import type { LunarSiteAssessment } from './lunarAssessment.ts'
import type { MissionTelemetry } from './run.ts'

function exportAssessment(result: LunarSiteAssessment) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `lunar-site-${result.site.id}-${result.missionId}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LunarReview({ mission, data, save }: { mission: LunarMission; data: MissionTelemetry; save: Save }) {
  const current = assessLunarSite(mission, data)
  const prior = useMemo(() => {
    const results = new Map<string, LunarSiteAssessment>()
    for (const checkpoint of save.operations ?? []) {
      const approved = save.missions?.find(item => item.id === checkpoint.missionId)
      if (approved?.schemaVersion !== 3 || approved.id === mission.id) continue
      const result = readLunarSiteAssessment(approved, checkpoint)
      if (result) results.set(result.site.id, result)
    }
    return results
  }, [mission.id, save])
  return <section className="hq-panel ops-review lunar-review" aria-labelledby="site-assessment-heading">
    <div className="ops-panel-head">
      <div><h2 id="site-assessment-heading">Lunar Site Assessment</h2><p>{current.site.label} · {current.coordinateFrame}</p></div>
      <strong className={current.confidence === 'incomplete' ? 'hq-warn' : 'hq-good'}>
        {current.confidence === 'incomplete' ? 'Incomplete reconnaissance' : 'Orbital evidence available'}
      </strong>
    </div>
    <p className="ops-result-line">{current.findings.opticalEvidence}. Landing safety is <strong>{current.findings.landingSafety}</strong>.</p>
    <p>Candidate tiles and modeled lighting are illustrative. These optical samples provide context for future scouting.</p>
    <div className="hq-table-scroll" tabIndex={0} role="region" aria-label="Compare lunar candidate sites">
      <table>
        <thead><tr><th>Candidate tile</th><th>Coordinates</th><th>Returned scenes</th><th>Best sample</th><th>Lowest sampled Sun elevation</th><th>Orbital Earth service windows</th><th>Evidence status</th></tr></thead>
        <tbody>{Object.values(lunarSites).map(site => {
          const result = site.id === current.site.id ? current : prior.get(site.id)
          const gsd = result?.findings.bestGsdM
          const sun = result?.findings.minSunElevationDeg
          return <tr key={site.id}><th scope="row">{site.label}</th>
            <td>{site.latitudeDeg}°, {site.longitudeDeg}°</td>
            <td>{result ? `${result.coverage.deliveredScenes} / ${result.coverage.requiredScenes}` : '—'}</td>
            <td>{gsd == null ? '—' : `${gsd.toFixed(2)} m/px`}</td>
            <td>{sun == null ? '—' : `${sun.toFixed(1)}°`}</td>
            <td>{result?.findings.geometricEarthServiceWindows ?? '—'}</td>
            <td>{result?.confidence === 'orbital-evidence' ? 'Optical context returned' : result ? 'Incomplete' : 'Unobserved'}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
    <h3>Returned coverage</h3>
    {current.coverage.deliveredSamples.length ? <ul className="ops-reasons">{current.coverage.deliveredSamples.map(sample =>
      <li key={sample.acquiredAtS}>T+{sample.acquiredAtS.toFixed(1)} s · {(sample.acrossM / 1000).toFixed(2)} × {(sample.alongM / 1000).toFixed(2)} km approximate footprint · {sample.gsdM.toFixed(2)} m/px</li>)}</ul> :
      <p>No complete camera samples were returned. Acquired scenes on board remain unavailable for site assessment.</p>}
    <h3>Unknowns for a later surface mission</h3>
    <ul className="ops-reasons">{current.knownUnknowns.map(item => <li key={item}>{item}</li>)}</ul>
    <button onClick={() => exportAssessment(current)}>Export lunar site assessment</button>
  </section>
}
