import { useId } from 'react'
import { simulationRules } from '../simulation/catalog.ts'
import type { StepTelemetry } from '../simulation/types.ts'

const icons = {
  orbit: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM3 17c1 2 6 1 11-2s8-7 7-8-6-1-11 2-8 7-7 8Z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  back: 'M20 12H5m6-6-6 6 6 6',
  info: 'M12 11v5m0-8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  close: 'm6 6 12 12M18 6 6 18',
  coast: 'M3 8c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 13c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 18c3 0 3-2 6-2s3 2 6 2 3-2 6-2',
  crop: 'M12 21V9m0 7C6 16 4 13 4 8c5 0 8 3 8 8Zm0-5c0-5 3-7 8-7 0 5-3 8-8 8',
  play: 'm8 5 12 7-12 7Z',
  pause: 'M9 5v14m6-14v14',
  restart: 'M5 4v5h5m-5 0a8 8 0 1 1-.4 5',
  check: 'm5 12 5 5L20 7',
  warning: 'M12 8v5m0 3h.01M12 3 2 20h20Z',
} as const

export function Icon({ name }: { name: keyof typeof icons }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>
}

const stars = Array.from({ length: 75 }, (_, index) => ({
  x: (index * 137 + index * index * 11) % 560,
  y: (index * 73 + index * index * 17) % 410,
  opacity: 0.15 + (index % 7) * 0.09,
}))

export function OrbitGraphic({ step }: { step?: StepTelemetry }) {
  const id = useId()
  const angle = (step ? step.step / simulationRules.stepsPerOrbit * 360 : 325) * Math.PI / 180
  const distanceX = 192 * Math.cos(angle)
  const distanceY = 69 * Math.sin(angle)
  const tilt = -24 * Math.PI / 180
  const x = 280 + distanceX * Math.cos(tilt) - distanceY * Math.sin(tilt)
  const y = 199 + distanceX * Math.sin(tilt) + distanceY * Math.cos(tilt)
  const live = step?.activity === 'downlink'
  const capturing = step?.activity === 'capture'

  return (
    <svg viewBox="0 0 560 410" className="orbit-graphic" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-back`}><stop stopColor="#14425a" stopOpacity=".65" /><stop offset="1" stopColor="#0b1726" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-ocean`} cx="34%" cy="26%" r="81%"><stop stopColor="#246478" /><stop offset=".67" stopColor="#123247" /><stop offset="1" stopColor="#07131f" /></radialGradient>
        <linearGradient id={`${id}-land`} x2="1" y2="1"><stop stopColor="#79bbad" /><stop offset="1" stopColor="#234255" /></linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2=".8"><stop offset=".25" stopColor="#04121f" stopOpacity="0" /><stop offset="1" stopColor="#04121f" stopOpacity={step && !step.sunlit ? '.88' : '.55'} /></linearGradient>
        <clipPath id={`${id}-disc`}><circle cx="280" cy="199" r="125" /></clipPath>
        <pattern id={`${id}-grid`} width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#75bad6" strokeOpacity=".09" /></pattern>
      </defs>
      <rect width="560" height="410" fill={`url(#${id}-grid)`} />
      <ellipse cx="280" cy="205" rx="260" ry="190" fill={`url(#${id}-back)`} />
      {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={index % 8 === 0 ? 1.4 : .7} fill="#b8e4ef" opacity={star.opacity} />)}
      <circle cx="280" cy="199" r="146" fill="none" stroke="#70cbd3" strokeOpacity=".2" strokeDasharray="2 7" />
      <path d="M80 199h400M280 20v355" stroke="#80c9d7" strokeOpacity=".15" strokeDasharray="3 6" />
      <ellipse cx="280" cy="199" rx="192" ry="69" transform="rotate(-24 280 199)" fill="none" stroke="#63e1bc" strokeOpacity=".45" strokeDasharray="3 6" />
      <circle cx="280" cy="199" r="131" fill="#59e3d8" opacity=".08" />
      <circle cx="280" cy="199" r="125" fill={`url(#${id}-ocean)`} stroke="#8de1e7" strokeWidth="1.5" />
      <g clipPath={`url(#${id}-disc)`}>
        <path d="m157 123 32-28 24-2 15-10 28 3 13 10-7 12-18 4-7 12 11 12-11 8-12-3-8 15-16 9 9 20 16 14 7 18-12-8-14-16-17-3-10-17-16-6-17-20Zm76 89 12-2 9 9 17 8 16 12 6 15-10 10-9 20-15 14-5 19-13-9 1-28-10-13-6-22Zm34-108 15-23 33-9 12 13-12 15-9 18-14 6-8-12Zm67 37 12-14 15-5 14-16 28 5 29 21 6 23-23 12-15-7-12 10-15-1-10 11-11-5-4-16-14-1Zm13 45 22-8 22 10 13 20-9 19-10 5-4 24-11 10-12-15-2-23-13-15-4-15Zm50 77 7-13 4 8-4 14Z" fill={`url(#${id}-land)`} stroke="#86d0c4" strokeOpacity=".45" strokeWidth="1.1" />
        <g fill="none" stroke="#9bdeed" strokeOpacity=".19">
          <ellipse cx="280" cy="199" rx="65" ry="125" />
          <ellipse cx="280" cy="199" rx="101" ry="125" />
          <path d="M280 74v250M155 199h250m-239-46q114 34 228 0m-228 92q114-34 228 0m-194-127q80 22 160 0m-160 162q80-22 160 0" />
        </g>
        <circle cx="280" cy="199" r="126" fill={`url(#${id}-shade)`} />
      </g>
      <path d="M104.6 277.1a192 69-24 0 0 350.8-156.2" fill="none" stroke="#73f7cc" strokeWidth="1.4" strokeOpacity=".85" />
      <circle cx="228" cy="193" r="4" fill="#f0bf72" />
      <circle cx="228" cy="193" r="10" fill="none" stroke="#f0bf72" strokeOpacity=".7" />
      {live && <path d={`M${x},${y}L228,193`} stroke="#77edba" strokeWidth="2" strokeDasharray="5 5" />}
      {capturing && <path d={`M${x},${y}L240,210L267,224Z`} fill="#71d6fc" fillOpacity=".22" stroke="#71d6fc" strokeDasharray="4 4" />}
      <g transform={`translate(${x} ${y}) rotate(-24)`} className={step ? 'orbit-craft' : undefined}>
        <circle r="26" fill="#9bf4dc" fillOpacity=".13" stroke="#9bf4dc" strokeOpacity=".4" />
        <path d="M-36-8h23V8h-23zm49 0h23V8H13z" fill="#254e67" stroke="#a0dce9" />
        <path d="M-29-8V8m8-16V8m42-16V8m8-16V8M-36 0h23m26 0h23" stroke="#72aec5" strokeWidth=".6" />
        <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#d4e3d9" stroke="#f1fff9" />
        <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#173647" stroke="#81dabd" />
        <path d="M0-12v-9l8-5" fill="none" stroke="#e5f8f0" />
      </g>
    </svg>
  )
}
