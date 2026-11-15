import { forecastProfile } from './forecast.ts'
import type { Forecast, Interval } from './forecast.ts'
import { lunarProfile } from './lunarScenario.ts'

const hours = (s: number) => {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}
const mb = (bits: number) => (bits / 8e6).toFixed(2)
const bestGsd = (forecast: Forecast) => forecast.accesses.length ? Math.min(...forecast.accesses.map(window => window.bestGsdM)) : null
const minSoc = (forecast: Forecast) => forecast.power.capacityJ ? 100 * forecast.power.minChargeJ / forecast.power.capacityJ : null

function Timeline({ windows, total, label, tone }: { windows: readonly Interval[]; total: number; label: string; tone: string }) {
  return <div className="forecast-lane">
    <span>{label}</span>
    <svg viewBox="0 0 1000 14" preserveAspectRatio="none" aria-hidden="true">
      {[250, 500, 750].map(x => <line key={x} x1={x} x2={x} y1={0} y2={14} />)}
      {windows.map(window => <rect key={window.startS} className={tone} x={1000 * window.startS / total}
        width={1000 * (window.endS - window.startS) / total} height={14} />)}
    </svg>
  </div>
}

export function ForecastPanel({ forecast, lunar = false }: { forecast: Forecast; lunar?: boolean }) {
  const { durationS, instrument, science, power, communications, missed, contacts, accesses } = forecast
  const minCharge = minSoc(forecast)
  const reasons = [
    ['Below horizon', missed.horizon], ['Outside pointing limit', missed.pointing], ['Footprint or limb limit', missed.footprint],
    ['Insufficient target sunlight', missed.lighting], ['GSD exceeds requirement', missed.resolution], ['No imager mounted', missed.payload],
  ] as const
  const batteryPoints = power.capacityJ ? power.batteryTrace.map(point =>
    `${(1000 * point.elapsedS / durationS).toFixed(2)},${(42 * (1 - point.chargeJ / power.capacityJ)).toFixed(2)}`).join(' ') : ''
  return <section className="hq-panel forecast-panel" aria-labelledby="forecast-heading">
    <div className="forecast-head">
      <div><h2 id="forecast-heading">Mission feasibility forecast</h2><p>{durationS / 3600} hours from the synthetic start epoch · 5 s midpoint sampling · Illustrative scenario</p></div>
      <output aria-label="Forecast scene delivery">{communications.delivered} / {science.goal} complete scenes</output>
    </div>
    <div className="forecast-timeline" aria-label="Forecast timeline in elapsed mission time">
      <Timeline label="Target access" windows={accesses} total={durationS} tone="target" />
      <Timeline label={lunar ? 'Earth service' : 'Ground contact'} windows={contacts} total={durationS} tone="contact" />
      <Timeline label="Sunlight" windows={forecast.sunlight} total={durationS} tone="sunlight" />
      <Timeline label="Eclipse" windows={forecast.eclipses} total={durationS} tone="eclipse" />
      {batteryPoints && <div className="forecast-lane"><span>Battery charge</span>
        <svg className="forecast-charge" viewBox="0 0 1000 42" preserveAspectRatio="none" role="img" aria-label={`Battery charge on a zero to 100 percent scale, minimum ${minCharge?.toFixed(1)} percent`}>
          <polyline points={batteryPoints} />
        </svg></div>}
      <div className="forecast-ticks" aria-hidden="true"><span>T+</span><div>{[0, .25, .5, .75, 1].map(fraction => <span key={fraction}>{durationS * fraction / 3600} h</span>)}</div></div>
    </div>
    <div className="forecast-summary">
      <section><h3>Target and instrument</h3>
        <p>{accesses.length} qualifying windows · Field of view {instrument.fieldOfViewDeg?.toFixed(2) ?? '—'}° · Max off-nadir {instrument.maxPointingDeg}°</p>
        <p>{mb(instrument.sceneBits)} MB per raw scene. Window geometry is reported at the best sample spacing within each window.</p>
        {!instrument.spectralSuitability && <p>Imaging is excluded from the operations forecast until the payload covers the required spectrum.</p>}
      </section>
      <section><h3>Energy and operations</h3>
        <p>{minCharge?.toFixed(1) ?? '—'}% minimum charge · {(power.endChargeJ / 3600).toFixed(2)} Wh at end · {power.unmetJ.toFixed(1)} J unserved</p>
        <p>Starts fully charged. Sunlit output is {(lunar ? lunarProfile : forecastProfile).solarOutputFraction * 100}% of nameplate. Captured {science.captured}, with {mb(science.onboardBits)} MB onboard at end.</p>
        <p>Blocked 5 s samples · Imaging power {forecast.blockedOperations.imagingPower}, storage {forecast.blockedOperations.imagingStorage}, downlink priority {forecast.blockedOperations.imagingConflict}. Downlink power {forecast.blockedOperations.downlinkPower}.</p>
      </section>
      <section><h3>Communications feasibility</h3>
        <p><strong>RF link budget {communications.linkBudget}</strong> · {contacts.length} geometry windows</p>
        <p>{communications.rateBps / 1000} kb/s illustrative cap · {mb(communications.contactCapacityBits)} MB geometric upper bound · {mb(communications.deliveredBits)} MB forecast return. {lunar ? 'Contacts clear the Moon toward an assumed fixed Earth direction. Station availability and link margin are unassessed.' : communications.frequencyHz !== null && `Path loss uses an illustrative ${communications.frequencyHz / 1e9} GHz carrier.`}</p>
      </section>
    </div>
    <details className="hq-detail"><summary>Target windows and missed geometry</summary>
      {accesses.length > 0
        ? <div className="hq-table-scroll" tabIndex={0} role="region" aria-label="Target access windows"><table>
          <thead><tr><th>Start T+</th><th>Duration</th><th>Off-nadir</th><th>Slant range</th><th>GSD</th><th>Footprint</th></tr></thead>
          <tbody>{accesses.map(window => <tr key={window.startS}><td>{hours(window.startS)}</td><td>{window.endS - window.startS} s</td>
            <td>{window.offNadirDeg.toFixed(1)}°</td><td>{(window.rangeM / 1000).toFixed(1)} km</td>
            <td>{window.bestGsdM.toFixed(1)} m/px</td><td>{(window.acrossM / 1000).toFixed(1)} × {(window.alongM / 1000).toFixed(1)} km</td></tr>)}</tbody>
        </table></div> : <p>No sample met all geometric and lighting requirements.</p>}
      <p>Rejected samples by first failed check (one sample every 5 s).</p>
      <ul>{reasons.filter(([, count]) => count > 0).map(([reason, count]) => <li key={reason}>{reason} · {count.toLocaleString()}</li>)}</ul>
    </details>
    <details className="hq-detail"><summary>{lunar ? 'Assumed Earth visibility windows' : 'Ground-station windows and path loss'}</summary>
      <p>{lunar ? 'A parallel ray toward the scenario Earth direction must clear the lunar sphere. Station elevation, slant range and path loss are unassessed.' : 'Fictional terminal at 35° N, 106° W with a 10° elevation mask. Path loss excludes antenna gains, transmit power, receiver noise, atmospheric losses, and other link terms.'}</p>
      {contacts.length ? <div className="hq-table-scroll" tabIndex={0} role="region" aria-label={lunar ? 'Earth service contact windows' : 'Ground contact windows'}><table>
        <thead><tr><th>Start T+</th><th>Duration</th>{!lunar && <><th>Slant range</th><th>Peak elevation</th><th>Max path loss</th></>}</tr></thead>
        <tbody>{contacts.map(window => <tr key={window.startS}><td>{hours(window.startS)}</td><td>{window.endS - window.startS} s</td>
          {!lunar && <><td>{window.minRangeM !== null && window.maxRangeM !== null ? `${(window.minRangeM / 1000).toFixed(0)}–${(window.maxRangeM / 1000).toFixed(0)} km` : '—'}</td>
            <td>{window.maxElevationDeg === null ? '—' : window.maxElevationDeg.toFixed(1) + '°'}</td><td>{window.maxPathLossDb === null ? '—' : window.maxPathLossDb.toFixed(1) + ' dB'}</td></>}</tr>)}</tbody>
      </table></div> : <p>{lunar ? 'No sampled window clears lunar occultation.' : 'No contact clears the elevation mask.'}</p>}
    </details>
    <details className="hq-detail"><summary>Eclipse intervals</summary>
      {forecast.eclipses.length ? <ul>{forecast.eclipses.map(interval => <li key={interval.startS}>{hours(interval.startS)}–{hours(interval.endS)} · {interval.endS - interval.startS} s</li>)}</ul> : <p>No sampled eclipse.</p>}
    </details>
  </section>
}

export interface ComparisonCase {
  label: string
  scenario: string
  altitudeKm: number
  inclinationDeg: number
  periodS: number
  forecast: Forecast
  massKg: number
  launch: string
  fits: boolean
  totalCents: number
}

export function Comparison({ baseline, current }: { baseline: ComparisonCase; current: ComparisonCase }) {
  const best = (entry: ComparisonCase) => bestGsd(entry.forecast)
  const soc = (entry: ComparisonCase) => minSoc(entry.forecast)
  const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  const costDelta = current.totalCents - baseline.totalCents
  const diff = (first: number | null, second: number | null, unit: string) =>
    first === null || second === null ? '—' : `${second - first > 0 ? '+' : ''}${(second - first).toFixed(1)}${unit}`
  const rows: readonly [string, (entry: ComparisonCase) => string | number, string][] = [
    ['Semi-major axis above sphere', entry => `${entry.altitudeKm} km`, diff(baseline.altitudeKm, current.altitudeKm, ' km')],
    ['Inclination', entry => `${entry.inclinationDeg}°`, diff(baseline.inclinationDeg, current.inclinationDeg, '°')],
    ['Orbital period', entry => `${(entry.periodS / 60).toFixed(1)} min`, diff(baseline.periodS / 60, current.periodS / 60, ' min')],
    ['Target access windows', entry => entry.forecast.accesses.length, diff(baseline.forecast.accesses.length, current.forecast.accesses.length, '')],
    ['Best qualifying GSD · lower is finer', entry => best(entry) === null ? '—' : `${best(entry)?.toFixed(1)} m/px`, diff(best(baseline), best(current), ' m/px')],
    ['Minimum battery charge', entry => soc(entry) === null ? '—' : `${soc(entry)?.toFixed(1)}%`, diff(soc(baseline), soc(current), ' pp')],
    ['Unserved load', entry => `${entry.forecast.power.unmetJ.toFixed(1)} J`, diff(baseline.forecast.power.unmetJ, current.forecast.power.unmetJ, ' J')],
    ['Ground contacts', entry => entry.forecast.contacts.length, diff(baseline.forecast.contacts.length, current.forecast.contacts.length, '')],
    ['Geometry capacity · illustrative', entry => `${mb(entry.forecast.communications.contactCapacityBits)} MB`,
      diff(baseline.forecast.communications.contactCapacityBits / 8e6, current.forecast.communications.contactCapacityBits / 8e6, ' MB')],
    ['Complete scenes forecast', entry => `${entry.forecast.communications.delivered} / ${entry.forecast.science.goal}`, '—'],
    ['Wet mass', entry => `${entry.massKg.toFixed(2)} kg`, diff(baseline.massKg, current.massKg, ' kg')],
    ['Launch fit', entry => `${entry.fits ? 'Fits' : 'Fails'} · ${entry.launch}`, '—'],
    ['Illustrative total cost', entry => dollars(entry.totalCents), (costDelta > 0 ? '+' : '') + dollars(costDelta)],
  ]
  return <>
    {baseline.scenario !== current.scenario && <p className="hq-warn">The target or science objective differs. Compare geometry and science in the context of each requirement.</p>}
    <div className="hq-table-scroll" tabIndex={0} role="region" aria-label="Mission trade comparison">
      <table><thead><tr><th>Measure</th><th>{baseline.label}</th><th>{current.label}</th><th>Change</th></tr></thead>
        <tbody>{rows.map(([name, format, change]) => <tr key={name}><th scope="row">{name}</th><td>{format(baseline)}</td><td>{format(current)}</td><td>{change}</td></tr>)}</tbody>
      </table>
    </div>
  </>
}
