import type { Save } from './saveFormat.ts'

export type Destination = 'earth' | 'moon' | 'wildfire'
export const plannerHref = (destination: Destination) =>
  destination === 'moon' ? '?mode=planning&body=moon' : destination === 'wildfire' ? '?mode=planning&scenario=wildfire' : '?mode=planning'
export function missionEntry(destination: Destination, save: Save | null) {
  if (!save) return { href: `?mode=headquarters&next=${destination}`, label: 'Create or load an agency', detail: 'An agency is required to save spacecraft and commit mission funding.' }
  if (destination === 'moon' && save.agency.research.status !== 'complete') return {
    href: '?mode=headquarters&next=moon', label: 'Continue lunar prerequisites',
    detail: save.agency.mission === 'accepted' ? 'Finish the pointing stability study to unlock lunar planning.' : 'Complete the training contract, then the pointing stability study.',
  }
  if (!save.assembly) return { href: `?mode=assembly&next=${destination}`, label: 'Build a spacecraft', detail: 'Save a vehicle in Assembly to start planning.' }
  return { href: plannerHref(destination), label: 'Plan mission', detail: 'Use your saved spacecraft to compare orbits and predict science return.' }
}
