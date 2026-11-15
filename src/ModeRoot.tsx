import { lazy, Suspense } from 'react'
import App from './App.tsx'
import { Headquarters } from './v2/Headquarters.tsx'
import { MissionHome } from './v2/MissionHome.tsx'
import './v2/competition.css'

const AssemblyWorkspace = lazy(() => import('./v2/assembly/Workspace.tsx'))
const Planner = lazy(() => import('./v2/planning/Planner.tsx'))
const Operations = lazy(() => import('./v2/operations/Workspace.tsx'))

export function ModeRoot() {
  const mode = new URLSearchParams(location.search).get('mode')
  if (mode === 'tutorial') {
    return <>
      <div className="tutorial-banner"><a href="?">Back to mission selection</a><span>Classic CubeSat tutorial · Illustrative</span></div>
      <App />
    </>
  }
  if (mode === 'assembly') {
    return <Suspense fallback={<p role="status">Loading vehicle assembly…</p>}><AssemblyWorkspace /></Suspense>
  }
  if (mode === 'planning') {
    return <Suspense fallback={<p role="status">Loading mission planning…</p>}><Planner /></Suspense>
  }
  if (mode === 'operations' || mode === 'demo') {
    return <Suspense fallback={<p role="status">Loading mission control…</p>}><Operations demo={mode === 'demo'} /></Suspense>
  }
  return mode === 'headquarters' ? <Headquarters /> : <MissionHome />
}
