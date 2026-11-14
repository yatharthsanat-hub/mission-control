# MISSION CONTROL 2.0 engineering architecture

Keep the static React + TypeScript + Vite app. Introduce V2 as a separate entry within the app, with the existing tutorial behind an explicit entry point. Use strict TypeScript for V2. Three.js draws the two 3D scenes through React Three Fiber; use Drei selectively for camera helpers after a compatibility and performance spike. Lazy-load per workspace, with an HTML assembly tree, 2D track and timeline as functional fallbacks. Bundle required assets and reference data. Rendering is a consumer of engineering outputs. [React Three Fiber documentation](https://r3f.docs.pmnd.rs/getting-started/introduction) · [Drei documentation](https://drei.docs.pmnd.rs/getting-started/introduction) · [Three.js documentation](https://threejs.org/docs/)

## Proposed module boundaries

| Module | Responsibility |
| --- | --- |
| `v2/domain` | IDs, units, requirements, diagnostics, immutable revisions and discriminated commands. Pure functions and serializable state. |
| `v2/program` | Agency reducer, contract lifecycle, ledger, research prerequisites and program calendar. Atomic command application with idempotency IDs. |
| `v2/catalog` | Versioned parts, ground terminals, launch solutions, constants, model parameter sets and provenance. Runtime decode at load. |
| `v2/assembly` | Tree validation, node pose composition, stowed geometry envelope, mode eligibility, mass/CoM and maneuver capability. |
| `v2/physics` | Pure functions for orbit, frames, geometry, propulsion, power, thermal, RF, pointing and instruments. Explicit errors for out-of-scope inputs. No React, Three objects, browser clocks or I/O. |
| `v2/planning` | Compile mission requirements, assemble preflight validation, forecast opportunities, estimate costs and freeze a run manifest. |
| `v2/runtime` | Deterministic simulation and command/event reducer. Worker adapter for asynchronous execution, cancel and bounded batches. |
| `v2/review` | Product completion, requirement evidence, financial reconciliation and like-for-like comparisons. |
| `v2/persistence` | IndexedDB transactions, migrations, JSON backup and recovery. |
| `v2/workspaces`, `v2/render` | React screens and render adapters. Local headless interaction state, camera state, command intents and read-only view models. |

## Proposed TypeScript contracts

Illustrative interface sketches. Brand identifiers and SI scalar quantities at validated construction boundaries. Unit suffixes remain visible in storage and logs. Runtime decoding rejects NaN, Infinity, invalid dimensions, unknown IDs and unsafe currency integers.

```ts
type Vec3 = readonly [number, number, number]
type Quaternion = readonly [number, number, number, number] // x y z w, unit norm
type UsdCents = number & { readonly __usdCents: unique symbol }
type Body = 'earth' | 'moon'
type Family = 'earth-observation' | 'lunar-reconnaissance'
type ModelStatus = 'VALIDATED' | 'TESTED' | 'ILLUSTRATIVE' | 'NOT IMPLEMENTED'
type Provenance =
  | { kind: 'sourced'; url: string; locator: string; revision: string; units: string }
  | { kind: 'simplified'; modelId: string; scopeId: string; sourceUrls: readonly string[] }
  | { kind: 'illustrative'; scenarioId: string; rationale: string }
  | { kind: 'planned'; dependency: string }
type Input<Q> = { value: Q; provenance: Provenance }

interface Agency {
  id: string; name: string; programDay: number
  ledger: readonly LedgerEntry[]
  research: Record<string, ResearchProgress>
  missionIds: readonly string[]
}
type LedgerEntry =
  | { id: string; kind: 'grant' | 'settlement'; amount: UsdCents; contractId: string }
  | { id: string; kind: 'reserve' | 'expense' | 'release'; amount: UsdCents; commitmentId: string }
type ResearchProgress =
  | { status: 'scheduled'; startDay: number; readyDay: number; commitmentId: string }
  | { status: 'complete'; completedDay: number }
interface Pose { positionM: Vec3; orientation: Quaternion }
interface AttachmentNode {
  id: string; interfaceId: string; role: 'host' | 'guest'; partFromNode: Pose
  allowedTwistRad: readonly number[]
}
interface PartDefinition {
  id: string; revision: string; dryMassKg: Input<number>; dryComM: Input<Vec3>
  procurement: Input<UsdCents>; nodes: readonly AttachmentNode[]
  stowedHullVerticesM: readonly Vec3[]
  capability: PartCapability
}
interface PartInstance { id: string; partRef: string; propellantKg: number }
interface Attachment {
  parent: string; parentNode: string; child: string; childNode: string; twistRad: number
}
interface Assembly {
  revision: string; root: string; parts: Record<string, PartInstance>; edges: readonly Attachment[]
}
interface CartesianState {
  body: Body; frameId: string; epochTdbSeconds: number; positionM: Vec3; velocityMps: Vec3
}
type OrbitInput = { kind: 'state'; state: CartesianState } |
  { kind: 'elements'; body: Body; frameId: string; epochTdbSeconds: number
    aM: number; e: number; iRad: number; raanRad: number; argPeriRad: number; meanAnomalyRad: number }
interface MissionDefinition {
  id: string; revision: string; family: Family; body: Body; scienceUser: string
  requirements: readonly Requirement[]; allowedLaunchOfferIds: readonly string[]
  phasePlanId: string; areaOfInterestId: string
}
interface RunManifest {
  missionRef: string; assemblyRevision: string; catalogRevision: string; physicsRevision: string
  environmentRevision: string; launchOfferRef: string; initialState: CartesianState
  initialPropellantByTankKg: Readonly<Record<string, number>>
  initialBatteryJ: number; initialTemperatureK: number
  endTimeS: number; plannedCommands: readonly FlightCommand[]
}
type Phase = 'deployment' | 'checkout' | 'maneuver' | 'survey' | 'closeout'
type FlightCommand =
  | { id: string; applyAtS: number; kind: 'mode'; modeId: string }
  | { id: string; applyAtS: number; kind: 'observe'; targetId: string }
  | { id: string; applyAtS: number; kind: 'burn'; inertialDeltaVMps: Vec3 }
interface TelemetrySample {
  elapsedS: number; phase: Phase; state: CartesianState; batteryJ: number; netBusW: number
  propellantKg: number; temperatureK: number; pointingErrorRad: number
  activeStationId: string | null; linkMarginDb: number | null
  storedBits: number; downlinkedBits: number; lastEventSequence: number
}
type MissionEvent = { sequence: number; elapsedS: number; phase: Phase } &
  ({ kind: 'observation'; productId: string } |
   { kind: 'contact'; stationId: string; transition: 'start' | 'end' } |
   { kind: 'mode' | 'burn' | 'inhibit' | 'eclipse'; reasonCode: string; commandId?: string })
interface RequirementOutcome {
  requirementId: string; status: 'met' | 'missed' | 'unevaluable'; evidenceIds: readonly string[]
}
interface ScienceProduct {
  id: string; tileId: string; capturedAtS: number; gsdM: number
  totalBits: number; receivedBits: number; qualityIssueCodes: readonly string[]
}
```

`PartCapability` is a tagged union of structure, imager, array, battery, radio, tank, thruster and attitude system. Allow a documented integrated bus composition. `Requirement` is a discriminated union for quality, completeness, constraints and deadlines, with metric-specific units and thresholds. Freeze referenced data by content hash and retain release catalogs for replay. Launch offers carry interface, stowed and wet limits, allowed state bounds, station/service terms and quote breakdown. Use stable product IDs. Credit a complete quality-approved tile once per contract definition even if downlinked in pieces by several passes.

## Assembly and run semantics

- Use a rooted tree with one parent per non-root part and one occupancy per node. Reject cycles, duplicate IDs, incompatible interface/gender, invalid twists and proxy overlap beyond documented mating clearances. Derive child world pose as `worldFromParent · parentFromHostNode · matingTransform · inverse(childFromGuestNode)`. The mating transform reverses the outward normal via the interface convention and applies the permitted twist about the host normal. Use the same resolved pose for mass properties and rendering. Remove a subtree atomically. Apply attach, rotate and remove as validated history commands, with inverse patches or complete small assembly snapshots and redo invalidated by a new edit. Undo/redo applies to drafts. Use a new revision for changes after commitment.
- Store physics model ID/revision and provenance alongside engineering results. Compile the immutable flight manifest from a validated plan and launch transaction, then start one run from that snapshot. Preview forecasts are disposable. Committed commands are ordered by simulation time, fixed event priority and sequence. Causality order at each boundary is integrate prior interval, update geometry/window state, deliver arrived uplink commands, check inhibits/fuel/pointing, then apply commanded actions and emit new state. Execute an impulse exactly once. Ground-issued commands have transmit and arrival times and a valid contact at arrival. Branch hypothetical edits from a checkpoint. Scrubbing plays past samples without executing commands or ledger mutations.
- Subdivide intervals at contacts, eclipse, thermal/battery boundaries and commands. Report forecasts as forecasts and execution as execution. Use a fixed deterministic physics policy and event brackets independent of render frame rate. Uint/Float64 chunks can hold timeline samples in a worker, while authoritative state and plot values remain double precision. Transfer bounded buffers to the view. Rebase scene origin and scale in rendering for lunar distances. Interpolate pose for display between safe samples, with no interpolation across burns or discontinuities. Provide a text event list and an equivalent 2D mode when WebGL is unavailable.

## NASA source traceability

Maintain a versioned source registry with a stable source ID, exact URL/title and locator, contribution category, access or release revision and attribution terms. Reference it from sourced catalog values, requirement definitions, and validation fixtures. A numerical record preserves the original value and unit and the SI conversion rule. State and orientation artifacts also carry origin, frame, time scale, epoch or coverage interval, interpolation and hash. Derived outputs retain their model revision and input IDs. Archive or pin the registry revision with the run manifest, and keep source links accessible from a requirement result. Track use of NASA inputs, guidance and benchmark tools independently of implementation validation status. See the [NASA resource integration audit](NASA_RESOURCE_INTEGRATION.md).

## Saves and consistency

Use IndexedDB stores for agency snapshot, authored revisions, immutable run manifests, command logs and cached telemetry. Save envelope includes `schemaVersion`, `catalogRevision`, checksum, save ID, and revision number. Commit edits and ledger entries in a transaction that compares the expected revision. Concurrent tabs get a conflict and can reload or fork a copy. Preserve the last readable save on failed migration or quota errors. Apply ordered pure transforms between schema versions, validate the result before publishing, retain a pre-migration backup and refuse to overwrite unknown future formats. Export/import a bounded JSON envelope with runtime validation. Checksums detect accidental corruption. Archive essential review summaries and pinned manifests even if disposable telemetry must be evicted. Saves are origin-local and can be cleared by the browser. [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
