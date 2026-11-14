import { missionObjectives, simulationRules } from '../simulation/catalog.ts'
import { compareMissions } from '../simulation/compare.ts'
import type { CompletedMission } from '../simulation/simulate.ts'
import { Icon } from './Visuals.tsx'

export function Results({ run, previous, redesign, briefing }: {
  run: CompletedMission
  previous: CompletedMission | null
  redesign: () => void
  briefing: () => void
}) {
  const { completion, metrics, resources, score, findings } = run
  const mission = missionObjectives[run.configuration.objective]
  const comparison = previous && compareMissions(previous, run)
  const percent = (charge: number) => Math.round(100 * charge / metrics.batteryCapacityWattMinutes)
  const scoreParts = simulationRules.score
  const stats = [
    { label: 'Scenes captured', value: metrics.observationsCaptured, note: `of ${metrics.observationsAttempted} scheduled views` },
    { label: 'Complete scenes delivered', value: `${metrics.usableObservations} / ${completion.targetScenes}`, note: `${metrics.deliveredMB} MB transmitted` },
    { label: 'Power outage steps', value: metrics.outageSteps, note: `${simulationRules.stepMinutes} minutes per step` },
    { label: 'Final battery charge', value: `${percent(metrics.finalBatteryWattMinutes)}%`, note: `${percent(metrics.minimumBatteryWattMinutes)}% minimum charge` },
    { label: 'Remaining budget', value: `${resources.remainingCredits} cr`, note: `${resources.costCredits} cr spent` },
    { label: 'Launch mass headroom', value: `${(resources.massHeadroomGrams / 1000).toFixed(2)} kg`, note: `${(resources.massGrams / 1000).toFixed(2)} kg spacecraft` },
  ]

  return (
    <>
      <div className={completion.success ? 'result-banner panel success' : 'result-banner panel failure'}>
        <div>
          <p className="eyebrow">{mission.name} · Mission debrief</p>
          <h1><Icon name={completion.success ? 'check' : 'warning'} /> Mission {completion.success ? 'SUCCESS' : 'FAILURE'}</h1>
          <p>{completion.success
            ? `${metrics.usableObservations} complete scenes reached the ${mission.scienceUser.toLowerCase()} and housekeeping stayed powered throughout the mission.`
            : `Delivered ${metrics.usableObservations} of ${completion.targetScenes} required scenes with ${metrics.outageSteps} outage ${metrics.outageSteps === 1 ? 'step' : 'steps'}. Success requires the scene target and zero power outages.`}</p>
        </div>
        <div className="score-block"><span>Performance score</span><strong>{score.displayTotal}<small> / 100</small></strong></div>
      </div>
      <dl className="result-stats">{stats.map(stat => <div className="panel" key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd><p>{stat.note}</p></div>)}</dl>
      <div className="debrief-grid">
        <section className="panel debrief-panel">
          <h2>Engineering findings</h2>
          {findings.length ? <ul className="findings">{findings.map(finding => <li key={finding.code}><strong>{finding.message}</strong><p>{finding.suggestion}</p></li>)}</ul>
            : <p>Telemetry recorded no power outages or blocked observations and no data remained onboard.</p>}
        </section>
        <section className="panel debrief-panel">
          <h2>Score breakdown</h2>
          <dl className="telemetry-list">
            <div><dt>Delivered science</dt><dd>{score.science.toFixed(1)} / {scoreParts.sciencePoints}</dd></div>
            <div><dt>Power continuity and charge</dt><dd>{score.operations.toFixed(1)} / {scoreParts.continuityPoints + scoreParts.chargePoints}</dd></div>
            <div><dt>Mass and budget efficiency</dt><dd>{score.efficiency.toFixed(1)} / {scoreParts.budgetPoints + scoreParts.massPoints}</dd></div>
          </dl>
          <p className="muted">{metrics.storedMB} MB remained onboard. Only fully received scenes count toward the science target.</p>
        </section>
      </div>
      {comparison?.status === 'comparable' && previous && (
        <section className="panel debrief-panel comparison">
          <h2>Design comparison</h2>
          <p>Previous mission {comparison.previousSuccess ? 'succeeded' : 'failed'} · Revised mission {comparison.revisedSuccess ? 'succeeded' : 'failed'}</p>
          <table>
            <thead><tr><th scope="col">Metric</th><th scope="col">Previous</th><th scope="col">Revised</th><th scope="col">Change</th></tr></thead>
            <tbody>
              <ComparisonRow label="Complete scenes" before={previous.metrics.usableObservations} delta={comparison.deltas.usableObservations} />
              <ComparisonRow label="Outage steps" before={previous.metrics.outageSteps} delta={comparison.deltas.outageSteps} lowerIsBetter />
              <ComparisonRow label="Spacecraft mass (kg)" before={previous.resources.massGrams / 1000} delta={comparison.deltas.massGrams / 1000} digits={2} lowerIsBetter />
              <ComparisonRow label="Cost (cr)" before={previous.resources.costCredits} delta={comparison.deltas.costCredits} lowerIsBetter />
              <ComparisonRow label="Score (points)" before={previous.score.total} delta={comparison.deltas.score} digits={1} />
            </tbody>
          </table>
        </section>
      )}
      <div className="action-row results-actions">
        <div><p>Specifications, schedules and score weights are illustrative. See Sources &amp; assumptions for the engineering references.</p>
          <button className="text-button" onClick={briefing}><Icon name="back" /> Mission briefing</button></div>
        <button className="button primary" onClick={redesign}>Redesign Mission <Icon name="arrow" /></button>
      </div>
    </>
  )
}

function ComparisonRow({ label, before, delta, digits = 0, lowerIsBetter = false }: {
  label: string; before: number; delta: number; digits?: number; lowerIsBetter?: boolean
}) {
  const improvement = lowerIsBetter ? delta < 0 : delta > 0
  const unchanged = Number(delta.toFixed(digits)) === 0
  return (
    <tr>
      <th scope="row">{label}</th><td>{before.toFixed(digits)}</td><td>{(before + delta).toFixed(digits)}</td>
      <td className={unchanged ? 'muted' : (improvement ? 'positive' : 'negative')}>
        {unchanged ? 'No change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(digits)} · ${improvement ? 'Improved' : 'Worsened'}`}
      </td>
    </tr>
  )
}
