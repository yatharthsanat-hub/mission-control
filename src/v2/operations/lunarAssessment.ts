import type { LunarMission } from '../planning/mission.ts'
import { createMissionRun } from './run.ts'
import type { MissionRecord, MissionTelemetry } from './run.ts'

const unknowns = [
  'Surface slope, boulders, craters, and landing hazards',
  'Persistent illumination, local shadows, and surface temperatures',
  'Surface bearing strength, dust and subsurface resources',
  'Operational Earth link budget, station availability and surface relay coverage',
] as const

export function assessLunarSite(mission: LunarMission, telemetry: MissionTelemetry) {
  if (!telemetry.complete) throw new Error('Complete the mission before producing an assessment.')
  const deliveredSamples = telemetry.observations.slice(0, telemetry.resources.delivered)
  const complete = deliveredSamples.length >= mission.objective.scenes
  const bestGsdM = deliveredSamples.length ? Math.min(...deliveredSamples.map(sample => sample.gsdM)) : null
  const minSunElevationDeg = deliveredSamples.length ? Math.min(...deliveredSamples.map(sample => sample.sunElevationDeg)) : null
  return {
    schemaVersion: 1 as const,
    missionId: mission.id,
    site: mission.target,
    coordinateFrame: mission.environment.fixedFrame,
    confidence: complete ? 'orbital-evidence' as const : 'incomplete' as const,
    coverage: {
      eligibleWindows: telemetry.targetWindows, acquiredScenes: telemetry.resources.captured,
      deliveredScenes: deliveredSamples.length, requiredScenes: mission.objective.scenes, deliveredSamples,
    },
    findings: {
      bestGsdM, minSunElevationDeg, geometricEarthServiceWindows: telemetry.contactWindows,
      creditedDataBits: deliveredSamples.length * mission.spacecraft.payload.sceneBits,
      opticalEvidence: complete ? 'Repeat sunlit optical context returned' : 'Insufficient returned evidence',
      landingSafety: 'NOT ASSESSED' as const,
    },
    knownUnknowns: unknowns,
    provenance: { model: mission.analysisProfile.revision, orbit: mission.models.orbit, sources: mission.sources,
      confidenceScope: 'ILLUSTRATIVE' as const },
  }
}

export type LunarSiteAssessment = ReturnType<typeof assessLunarSite>

// The saved run is the single source of truth for science evidence.
export function readLunarSiteAssessment(mission: LunarMission, record: MissionRecord): LunarSiteAssessment | null {
  if (record.elapsedS !== mission.analysisProfile.durationS) return null
  return assessLunarSite(mission, createMissionRun(mission, record).snapshot())
}
