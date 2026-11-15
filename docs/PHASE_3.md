# Phase 3 · Mission Operations and Science Review

## Player workflow

1. Create an agency in Headquarters. Complete the training review and research if you want the fine-pointing hardware. Build and save a spacecraft in Vehicle Assembly.
2. In Mission Planning, evaluate its trajectory and engineering constraints. Approve a feasible schema 2 design and acknowledge the unassessed RF margin. Open Mission Control from the approval or from the Headquarters mission list.
3. Start the approved flight in orbit with the imager and radio in standby. The 3D view shows the calculated spacecraft state, osculating orbit, spherical ground track, target and station. Orbit, zoom and pan with the camera controls. The 2D ground-track view provides the same positions and the full flight console when WebGL is unavailable.
4. Use the opportunity timeline and flight console. Schedule imaging and downlink by arming each subsystem, or manually command one interval. Check charge, current geometry, acquired scenes, data stored and completed deliveries. Interrupt operations by putting a subsystem in standby. Review rejected commands and missed windows in the event log.
5. Advance through the approved duration and open Science and Program Review. It compares forecast and actual acquisitions, deliveries, data volumes, charge and unmet energy. It also reports missed observations and contacts, queued data, objective status, and the approval commitment.

### Transport and command behavior

| Control | Effect |
| --- | --- |
| Play, pause, speed, step | Change presentation cadence. Step advances one 5 s integration bin. Pausing checkpoints the exact simulated boundary. |
| Arm or hold imaging | Enable target-window acquisition until placed on hold. The shared model permits one qualifying scene per contiguous window, up to the approved acquisition quota. |
| Capture now | Check geometry, spectrum, downlink priority, storage and available energy in the next integration bin. Rejected attempts are logged. |
| Arm or hold downlink | Allow queued data to transmit at the next valid contacts, or leave the radio in standby. |
| Transmit 5 s now | Attempt a single bin at the illustrative service rate. The model checks geometric contact, data and energy, with a separate rejection for each missing condition. |
| Go to next target or contact | Advance every intervening bin with the current modes, then pause before the chosen future opportunity. |
| Run to end and review | Execute the remainder with the current modes and show the completed review. |
| Save checkpoint and reset | Save elapsed time and command history. Reset replaces the current flight checkpoint for this approval and starts back in standby. |

Success requires the approved number of complete scene deliveries and zero unserved housekeeping energy. Partial success requires at least one complete delivery when full success criteria are missed. Zero complete deliveries is failure. A command, a scheduled opportunity, a stored scene, a partial transmission and a fully received scene are distinct events or outcomes. Readiness blocks unsuitable plans before approval. The shared flight rules also check spectrum and target access when executing each acquisition.

## Architecture, science and NASA provenance

- **Shared flight models.** `src/v2/planning/flightModel.ts` now owns the Phase 2.5 interval sampling and resource update. The forecast supplies requests whenever its policy permits. The runner supplies requests from timestamped operator modes and manual commands. Both consume the same assembly, orbit, energy, optics, spectrum and communications inputs. The existing two-body kernel derives Cartesian state and the fixed-frame transform uses the approved JPL Earth GM and sidereal period. The globe and map render that state. [JPL Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html)
- **Acquisition and power.** The approved Landsat 9 reference bands gate the illustrative camera response. Geometry enforces the approved pointing, lighting, footprint and ground-sampling limits. Eclipse, derated solar nameplate output, housekeeping and activity loads use the shared battery ledger in joules. The display separates instantaneous propagated state at the clock boundary from next-interval eligibility evaluated at its midpoint. [NASA Landsat 9](https://science.nasa.gov/mission/landsat-9/) · [NASA Small Spacecraft Technology Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/)
- **Communications.** Contact requires the approved station elevation mask. The illustrative capped rate transfers FIFO bits after the shared energy check. Partial data can free storage, and only a complete scene earns delivery credit. Displayed contact and transferred science remain conditional on the approved training-rate assumption. RF margin remains **NOT ASSESSED**. [NASA Small Spacecraft Technology Communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/)
- **Confidence.** Two-body propagation and free-space path loss are **TESTED**. The integrated engineering scenario is **ILLUSTRATIVE**. End-to-end RF margin is **NOT ASSESSED**. Real Earth orientation, cloud and terrain effects, image processing and attitude dynamics are **NOT IMPLEMENTED**. Independent GMAT validation remains pending.

The 24-hour run integrates 5 s bins at their midpoint under the approved model. Clock speed controls how many complete bins the browser processes, with fractional wall-time carry between updates. Render frames and 3D camera state do not enter the equations. Given identical commands at identical simulated boundaries, batching produces the same state and events. Boundaries are sampled, so brief eclipses, contacts or optical accesses may be missed. The synthetic globe uses a coordinate grid and no operational map or terrain dataset.

## Compatibility and program accounting

The approved `MissionConfiguration` schema 2 remains unchanged. It supplies the assembly snapshot, model revisions and the environment throughout execution. Legacy schema 1 approvals remain readable and can be revised and reapproved in Mission Planning to enter operations. They keep their original investments and approval records.

Agency save schema 5 adds a versioned operation record. It contains an approved mission ID, the elapsed simulation boundary and ordered commands with simulated issue times. The current flight reconstructs all resources and events through replay. Checkpoints save on start, commands, pause, jumps, reset, completion, manual save, and periodically during continuous playback. Closing a tab between checkpoints resumes from the latest saved boundary. IndexedDB rejects stale writes. The saved indicator follows the latest queued checkpoint so a prior write cannot signal that a newer checkpoint is durable. Replaying, resetting and reviewing issue no grants, payments or financial commitments. The original approval reserves funds through the existing agency ledger.

## Verification and Phase 4 boundary

- All 48 tests passed, including 41 inherited and seven operations tests. Coverage includes rejected commands, eclipse energy, spectral and power limits, storage, partial and complete downlink, missed contacts, all three verdicts, deterministic batching and replay, forecast parity, checkpoints, and financial idempotency. Strict TypeScript for both project configurations, ESLint, production build and Git whitespace checks passed. Vite reported a large lazy-loaded Three.js chunk shared by the globe and assembly views.
- Chrome completed the agency, training, research, assembly and approval journey. The successful flight returned both required scenes. In the failure case, imaging acquired both scenes and downlink remained in standby. The same reset and sequence reproduced the failure metrics and full event log. Reload restored both the successful and failed reviews. The walkthrough exercised manual and armed commands, accelerated play and pause, camera orbit, manual 2D switching, actual WebGL context loss, startup with WebGL disabled, and a 360 px layout.
- After Headquarters finished loading, Chrome verified the same single $132,700 commitment before flight and after success, reset, replay and reload. Cash remained $135,000, paid expenses $425,000, and available cash $2,300. The ledger entries were identical across those checks.
- Phase 3 is ready as the Earth-observation baseline for Phase 4. Lunar reconnaissance will require its own reference frames, ephemerides, science targets, lighting, communications and validation fixtures. The current mission definitions and integrated operating rules are scoped to Earth.
