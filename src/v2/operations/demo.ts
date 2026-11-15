import { applyCommand, createAgency } from '../agency.ts'
import { initialAssembly, revise } from '../assembly/engine.ts'
import { approvalContext, approveForecastMission, defaultPlan } from '../planning/mission.ts'
import { restoreRecord } from './run.ts'
import type { MissionRecord } from './run.ts'

export const demoCheckpointKey = 'mission-control-demo-earth-1'

export function createDemo() {
  const agency = createAgency('Demo Flight Program')
  const assembly = ([['imager', 'deck'], ['solar', 'starboard'], ['battery', 'battery'], ['radio', 'radio']] as const)
    .reduce((draft, [part, host]) => revise(draft, { kind: 'install', part, id: part, host, parent: 'bus', twist: 0 }, []), initialAssembly)
  const mission = approveForecastMission('demo-earth-1', {
    ...defaultPlan, orbit: { ...defaultPlan.orbit, altitudeKm: 400, inclinationDeg: 40, nodeDeg: 240 },
  }, assembly, approvalContext('demo-agency', agency), true)
  return {
    mission, save: { id: 'demo-agency', revision: 0, assembly, missions: [mission],
      agency: applyCommand(agency, { id: mission.id, kind: 'reserve-mission', cents: mission.budget.totalCents }) },
  }
}

export function readDemoCheckpoint(mission: ReturnType<typeof createDemo>['mission'], storage: Pick<Storage, 'getItem'>): MissionRecord | undefined {
  try {
    const raw = storage.getItem(demoCheckpointKey)
    return raw ? restoreRecord(JSON.parse(raw), mission) : undefined
  } catch { return undefined }
}
