import { createFlightModel } from '../planning/flightModel.ts'
import type { ApprovedMission, ExecutableMission } from '../planning/mission.ts'
import { environmentModel } from '../planning/environments.ts'

export const commands = {
  'arm-imaging': 'Arm imaging',
  'standby-imaging': 'Hold imaging',
  'arm-downlink': 'Arm downlink',
  'standby-downlink': 'Hold downlink',
  'image-now': 'Capture now',
  'downlink-now': 'Transmit now',
} as const

export type CommandKind = keyof typeof commands
interface Order { readonly atS: number; readonly kind: CommandKind }
export interface MissionRecord {
  readonly revision: 'earth-operations-1'
  readonly missionId: string
  readonly elapsedS: number
  readonly orders: readonly Order[]
}

const maxOrders = 512
const revision = 'earth-operations-1'
const field = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {}

export function restoreRecord(value: unknown, mission: ExecutableMission): MissionRecord {
  const record = field(value)
  const { durationS, stepS } = mission.analysisProfile
  if (record.revision !== revision || record.missionId !== mission.id || typeof record.elapsedS !== 'number' ||
      !Number.isSafeInteger(record.elapsedS) || record.elapsedS < 0 || record.elapsedS > durationS || record.elapsedS % stepS !== 0 ||
      !Array.isArray(record.orders) || record.orders.length > maxOrders) throw new Error('Invalid operations checkpoint.')
  const elapsedS = record.elapsedS
  let previous = -1
  const orders = record.orders.map(raw => {
    const { atS, kind } = field(raw)
    if (typeof atS !== 'number' || !Number.isSafeInteger(atS) || atS < 0 || atS < previous || atS > elapsedS ||
        atS >= durationS || atS % stepS !== 0 || typeof kind !== 'string' || !Object.hasOwn(commands, kind)) {
      throw new Error('Invalid command in operations history.')
    }
    previous = atS
    return Object.freeze({ atS, kind: kind as CommandKind })
  })
  return Object.freeze({ revision, missionId: mission.id, elapsedS, orders: Object.freeze(orders) })
}

export interface MissionEvent {
  readonly atS: number
  readonly kind: 'milestone' | 'command' | 'access' | 'contact' | 'power' | 'science' | 'warning'
  readonly text: string
}

export interface ObservationSample {
  readonly acquiredAtS: number
  readonly gsdM: number
  readonly acrossM: number
  readonly alongM: number
  readonly sunElevationDeg: number
}

function modeFor(kinds: readonly CommandKind[], imaging: boolean, radio: boolean) {
  for (const kind of kinds) {
    if (kind === 'arm-imaging' || kind === 'standby-imaging') imaging = kind === 'arm-imaging'
    if (kind === 'arm-downlink' || kind === 'standby-downlink') radio = kind === 'arm-downlink'
  }
  return { imaging, radio }
}

export function createMissionRun(mission: ApprovedMission, raw?: MissionRecord) {
  if (mission.schemaVersion === 1) throw new Error('Revise and reapprove this legacy mission in Mission Planning before flight.')
  const lunar = environmentModel(mission.environment).body === 'moon'
  const { durationS, stepS, lowChargeFraction } = mission.analysisProfile
  const model = createFlightModel(mission, mission.analysisProfile)
  const saved = raw ? restoreRecord(raw, mission) : undefined
  const orders = [...(saved?.orders ?? [])]
  const observations: ObservationSample[] = []
  const events: MissionEvent[] = [Object.freeze({ atS: 0, kind: 'milestone', text: 'Mission started in the approved orbit. Payload and radio in standby.' })]
  let orderIndex = 0
  let elapsedS = 0
  let next = model.sample(0)
  let resources = model.initial()
  let minChargeJ = resources.chargeJ
  let unmetJ = 0
  let imaging = false
  let radio = false
  let targetWindows = 0
  let contactWindows = 0
  let missedObservations = 0
  let missedContacts = 0
  let capturedBeforeWindow = 0
  let sentBeforeWindow = 0
  let dataDuringContact = false
  let previouslyAccess = false
  let previouslyContact = false
  let previousEclipse = next.eclipse
  let previousLow = false
  let previousOutage = false
  let lastActivity: ReturnType<typeof model.advance>['activity'] = 'housekeeping'
  let lastLoadW = mission.spacecraft.power.housekeepingW
  let lastReject = ''

  function log(kind: MissionEvent['kind'], text: string, atS = elapsedS) {
    events.push(Object.freeze({ atS, kind, text }))
  }

  function closeAccess(atS: number) {
    if (resources.captured === capturedBeforeWindow && resources.captured < mission.objective.scenes) {
      missedObservations++
      log('warning', 'Target window closed without a scene. ' + (lastReject || 'The imager was held or no capture command was issued.'), atS)
    } else log('access', 'Target window closed.', atS)
  }

  function closeContact(atS: number) {
    if (dataDuringContact && resources.deliveredBits === sentBeforeWindow) {
      missedContacts++
      log('warning', (lunar ? 'Earth service window' : 'Ground contact') +
        ' ended with no transmission while science was waiting. Check radio mode and available power.', atS)
    } else log('contact', lunar ? 'Assumed Earth direction is occulted or the mission ended.' : 'Geometric contact ended.', atS)
  }

  function step() {
    const frame = next
    const access = frame.access.available
    const contact = frame.station.inContact
    if (access !== previouslyAccess) {
      if (access) {
        targetWindows++
        capturedBeforeWindow = resources.captured
        lastReject = ''
        log('access', 'Target window opened. Viewing geometry, illumination and sampling requirements are met.')
      } else closeAccess(elapsedS)
    }
    if (contact !== previouslyContact) {
      if (contact) {
        contactWindows++
        sentBeforeWindow = resources.deliveredBits
        dataDuringContact = false
        log('contact', lunar ? 'Assumed Earth direction cleared the lunar limb. RF margin NOT ASSESSED.' :
          'Ground contact opened above the elevation mask. RF margin NOT ASSESSED.')
      } else closeContact(elapsedS)
    }
    if (frame.eclipse !== previousEclipse || elapsedS === 0) {
      log('power', frame.eclipse ? 'Eclipse entered. Solar generation is zero.' : 'Sunlight available. Derated solar generation is active.')
    }

    const due: CommandKind[] = []
    while (orders[orderIndex]?.atS === elapsedS) {
      const { kind } = orders[orderIndex++]
      due.push(kind)
      log('command', commands[kind] + ' commanded.')
    }
    const mode = modeFor(due, imaging, radio)
    imaging = mode.imaging
    radio = mode.radio
    const imageNow = due.includes('image-now')
    const transmitNow = due.includes('downlink-now')
    const result = model.advance(resources, frame, {
      observe: imageNow || (imaging && access),
      downlink: transmitNow || (radio && contact),
    })
    if (contact && resources.occupiedBits > 0) dataDuringContact = true
    if (access && result.captureReject) lastReject = result.captureReject
    const endS = elapsedS + stepS
    if (imageNow && result.captureReject) log('warning', 'Capture rejected. ' + result.captureReject, endS)
    if (transmitNow && result.downlinkReject) log('warning', 'Transmission rejected. ' + result.downlinkReject, endS)
    if (result.sentBits > 0 && (transmitNow || lastActivity !== 'downlink')) {
      log('contact', transmitNow ? `Manual transmission returned ${result.sentBits.toLocaleString('en-US')} bits.` :
        'Radio began transmitting queued science at the illustrative service rate.', endS)
    }
    if (result.resources.captured > resources.captured && frame.access.available) {
      observations.push(Object.freeze({ acquiredAtS: elapsedS + stepS / 2, gsdM: frame.access.bestGsdM,
        acrossM: frame.access.acrossM, alongM: frame.access.alongM, sunElevationDeg: frame.access.sunElevationDeg }))
      log('science', `Observation acquired at ${frame.access.bestGsdM.toFixed(1)} m/px. ${model.instrument.sceneBits.toLocaleString('en-US')} bits stored onboard.`, endS)
    }
    if (result.resources.delivered > resources.delivered) {
      log('science', `Scene ${result.resources.delivered} fully delivered and credited.`, endS)
      if (result.resources.delivered >= mission.objective.scenes) log('science', 'Science objective satisfied.', endS)
    }
    resources = result.resources
    minChargeJ = Math.min(minChargeJ, resources.chargeJ)
    unmetJ += result.energy.unservedJ
    const low = resources.chargeJ <= model.batteryCapacityJ * lowChargeFraction
    const outage = result.energy.unservedJ > 0
    if (low !== previousLow) log(low ? 'warning' : 'power', low ? 'Battery charge is at or below the 15% reserve advisory.' : 'Battery charge recovered above the advisory threshold.', endS)
    if (outage !== previousOutage) log(outage ? 'warning' : 'power', outage ? 'Power deficit. Housekeeping demand is partly unserved.' : 'Housekeeping power restored.', endS)
    lastActivity = result.activity
    lastLoadW = result.energy.loadW
    previouslyAccess = access
    previouslyContact = contact
    previousEclipse = frame.eclipse
    previousLow = low
    previousOutage = outage
    elapsedS = endS
    if (elapsedS === durationS) {
      if (access) closeAccess(elapsedS)
      if (contact) closeContact(elapsedS)
      log('milestone', 'Approved mission duration reached. Science review is available.')
    } else next = model.sample(elapsedS)
  }

  function advance(bins: number) {
    if (!Number.isSafeInteger(bins) || bins < 0) throw new RangeError('Expected a non-negative number of complete integration bins.')
    for (let index = 0; index < bins && elapsedS < durationS; index++) step()
  }

  function command(kind: CommandKind) {
    if (elapsedS >= durationS || !Object.hasOwn(commands, kind) || orders.length >= maxOrders) {
      throw new Error('Command is unavailable. Check mission status or the 512-command recording limit.')
    }
    orders.push(Object.freeze({ atS: elapsedS, kind }))
  }

  function snapshot() {
    const pending = orders.slice(orderIndex).map(order => order.kind)
    const complete = elapsedS === durationS
    const goal = mission.objective.scenes
    const verdict = resources.delivered >= goal && unmetJ === 0 ? 'Success' : resources.delivered > 0 ? 'Partial success' : 'Failure'
    return {
      elapsedS, complete, verdict, goal, ...modeFor(pending, imaging, radio), pending,
      orbital: model.at(elapsedS), upcoming: next, resources: { ...resources, pendingBits: [...resources.pendingBits] },
      minChargeJ, unmetJ, targetWindows, contactWindows, missedObservations, missedContacts,
      lastActivity, lastLoadW, events: [...events], observations: [...observations],
    } as const
  }

  function record(): MissionRecord { return { revision, missionId: mission.id, elapsedS, orders: [...orders] } }

  if (saved) advance(saved.elapsedS / stepS)
  return { advance, command, snapshot, record }
}

export type MissionTelemetry = ReturnType<ReturnType<typeof createMissionRun>['snapshot']>
