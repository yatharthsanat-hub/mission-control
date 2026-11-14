# MISSION CONTROL game design

Players build a fictional 3U Earth-observation CubeSat for a science user. Their job is to return usable images within a launch mass limit and budget while keeping the spacecraft powered. A complete attempt should take a few minutes. The same schedule repeats on redesign so a player can see what their change did.

## Play loop

1. **Briefing.** Choose coastal flood mapping (7 visible-light scenes for an emergency mapping team) or crop condition monitoring (8 red and near-infrared scenes for an agriculture team). Show the required bands, usable scene target, and 100-credit budget before component selection.
2. **Spacecraft design.** Select the compatible instrument, solar array, battery and radio. Show the fixed bus and on-board storage. On each part card, show the immediate changes in mass, price and performance. Explain why a sensor with missing bands cannot meet the brief.
3. **Launch and orbit.** Pick a rideshare offer with a fixed low Earth orbit profile, mass allowance and price. Preview sunlight, target views and station contacts. Allow edits from this screen. Launch requires all slots, a compatible imager, and mass and cost at or below their caps. Show every blocking constraint and its overage.
4. **Mission operations.** Choose a battery reserve policy before running. It changes which optional operations the spacecraft accepts. Run six simulated orbits with a concise timeline of sunlight, eclipse, imaging, downlink and low-power events. Show battery charge, stored data and scenes delivered. Let players step through by orbit or finish instantly.
5. **Results.** Report whether the objective was met, the score breakdown and one actionable bottleneck with evidence from the run. Show completed scenes vs. target, data still on board, skipped captures and their reasons, battery minimum, outages, and mass and cost margins.
6. **Redesign.** Return to the existing loadout and policy. Keep the previous completed run in memory and show changes in delivered scenes, outages and score after a rerun of the same brief. Changing objectives starts a new comparison.

## Illustrative loadout and launch offers

All values and schedules below are educational assumptions for playtesting. The sources support the system relationships, 3U terminology, and the use of visible and near-infrared observations in Earth imaging. See [Source audit](SOURCE_AUDIT.md#evidence-behind-the-simulation). Prices use game credits.

| Slot | Option | Mass (kg) | Credits | Modeled behavior |
| --- | --- | ---: | ---: | --- |
| Bus | Fixed 3U bus | 2.00 | 22 | 2 W housekeeping, 300 MB storage included |
| Imager | Visible camera | 0.40 | 12 | Coastal brief, 4 W extra during capture, 30 MB per scene |
| Imager | Red/NIR camera | 0.80 | 23 | Crop brief, 7 W extra during capture, 60 MB per scene |
| Solar | Body-mounted | 0.35 | 11 | 6 W in sunlight |
| Solar | Deployable | 0.80 | 20 | 10 W in sunlight |
| Battery | Compact | 0.30 | 8 | 2 Wh usable capacity |
| Battery | Extended | 0.70 | 15 | 5 Wh usable capacity |
| Radio | Low-rate | 0.25 | 8 | 6 MB/min, 3 W extra when transmitting |
| Radio | High-rate | 0.55 | 17 | 18 MB/min, 8 W extra when transmitting |

Each orbit has 18 five-minute steps indexed 0–17. Orbit numbers run from 1–6. Each capture step offers one distinct sunlit target scene.

| Offer | Limit | Price | Schedule |
| --- | ---: | ---: | --- |
| Mid-inclination LEO rideshare | 3.80 kg | 12 credits | Sun in steps 0–10. Coastal scenes at steps 2–4, crop scenes at step 3. Contact at steps 9–10 on orbits 1, 3 and 5 and step 10 on orbit 6. |
| Near-polar LEO rideshare | 4.60 kg | 17 credits | Sun in steps 0–11. Crop scenes at steps 2–4, coastal scenes at step 3. Contact at steps 12–13 on every orbit. |

Treat the profiles as two specific fictional launch and ground-station schedules. Their observation and eclipse patterns depend on scenario geometry. The near-polar offer trades more contact time for higher price and battery-powered transmission in eclipse.

## Simulation rules

- **Initial condition.** Each run starts with 100% of the selected battery's usable capacity, empty storage and zero delivered scenes. This models a precharged spacecraft at the start of operations. It gives the first orbit a head start and can make early operations possible before solar has replenished the energy spent. Larger batteries start with more stored energy. Charge carries forward between orbits, and six orbits of results establish performance only over that interval.
- **Energy accounting.** Treat solar output and loads as constant over each five-minute step. In watt-minutes, starting charge plus solar generation plus any unmet housekeeping demand equals ending charge plus nominal housekeeping and optional loads plus unused solar energy. Solar output is zero in eclipse. Subtract simultaneous loads before capping at battery capacity so available sunlight can power them even with a full battery. If available energy cannot cover housekeeping for the whole step, record an outage step, drain the remaining charge, and skip optional work. Exactly enough energy to reach zero charge still powers the step. The model tracks the energy shortfall and resolves outages at step boundaries. Within-step timing, current limits and transient loads are outside the model.
- **Operations priority.** At most one optional action runs per step. A contact with data already queued takes priority over imaging. If the radio would breach the reserve, leave both actions idle for that step. This preserves energy and can forfeit a target view during a scarce contact. With an empty queue, an overlapping imaging opportunity can proceed and its data waits for a later contact. The shipped schedules have no overlap. An optional action must leave at least the chosen 15% or 35% of usable battery capacity. Housekeeping can draw below that reserve.
- **Data accounting.** Capture adds one fixed-size scene only if storage can fit it. Downlink sends the lesser of queued data and radio rate × contact minutes, using a full step of radio energy for any transmission. Oldest bytes go first and free on-board space as they leave. Captured MB always equals transmitted MB plus stored MB. Transmitted MB includes any partial scene. Usable scenes count only fully received scenes, and the final incomplete scene's transmitted bytes earn zero science points.
- Use perfect charge and discharge efficiency and constant loads within each step. Omit weather, battery aging, pointing and deployment failures. Operational reliability comes from whether the power budget sustains housekeeping through the scheduled mission.

Example briefing feedback after a failed crop survey could read “6 of 8 scenes reached the agriculture team. Eight captures were skipped because storage was full. A faster radio would clear more data at each contact, but check how long the battery must last in eclipse.” A cheap coastal build with a low-rate radio can succeed with 7 delivered scenes. For the crop brief, a high-rate radio can deliver more than the target yet cause outages with the 15% policy. The 35% policy can deliver 9 usable scenes with zero outages on the same hardware.

### Verified crop reserve example

The near-polar design with body-mounted solar, a compact battery and a high-rate radio uses 98 credits and has a mass of 4.00 kg. Each eclipse begins at 120 watt-minutes (2 Wh). A five-minute radio step uses 50 watt-minutes including housekeeping.

| Reserve | What happens in each eclipse | Six-orbit result |
| --- | --- | --- |
| 15% (18 watt-minutes) | Both transmissions pass the reserve check, leaving 20 watt-minutes. Steps 14–15 use that charge. Housekeeping loses power in steps 16–17. | The first orbit returns 180 MB and each subsequent orbit returns 120 MB. The battery starts each later orbit depleted, so one capture per orbit is skipped for reserve. Total delivery is 780 MB, or 13 scenes, with 12 outage steps and a failed mission. |
| 35% (42 watt-minutes) | The second transmission would leave 20 watt-minutes, so it is skipped. Housekeeping uses the remaining five eclipse steps and the battery finishes at 20 watt-minutes. | Each orbit returns 90 MB. Total delivery is 540 MB, or 9 scenes, with zero outage steps and a successful mission. Another 180 MB remains on board. |

## Mission outcome and performance score

Success requires a valid launch, the briefing's delivered scene target, and zero housekeeping outage steps. A completed simulation can fail and still receive a performance score. For example, the crop run with 13 scenes scores 84/100 and fails because of outages. Display the outcome from `completion.success` alongside the score. A rejected launch stays in design with no run score.

| Points | Rule |
| --- | --- |
| 70 science | `70 × min(delivered / target, 1)`. Capturing more than the goal can help absorb losses, but extra delivered scenes earn zero additional points. |
| 20 operations | `10 × poweredSteps / totalSteps` plus `10 × min(minimum charge / (0.25 × battery capacity), 1)`. The 25% reference is a game tuning value. |
| 10 efficiency | `5 × min(remaining credits / 20, 1) + 5 × min(mass headroom / 0.50 kg, 1)`, multiplied by science completion. This rewards sufficient headroom on useful designs. |

Use unrounded values for decisions and round the total for display. Design iteration has no flat bonus. A player earns more by improving a measured outcome. A low-cost satellite that delivers the required science with margins can outperform a heavier, more expensive one.

The current catalog has 128 configurations, including incompatible imagers. Of 32 valid launches, 9 succeed. Within each brief, every successful design outscores every failed design in this catalog. Crop monitoring has one successful configuration, the 35% reserve example above.

## Hackathon scope

Ship one Earth-observation scenario family, two briefs, two orbit offers, two options per component slot, and a results screen with a one-run comparison. Use responsive forms and readable telemetry with text equivalents, labeled controls, visible focus, and statuses conveyed in words. Use original graphics and a simple 2D timeline.

Exclude accounts, multiplayer, leaderboards, backend, live NASA feeds, orbital propagation and GMAT integration, propulsion, free-flight controls, stochastic failures, detailed thermal/RF models, and 3D or VR. They expand validation and interface work before a player can finish and improve a mission. Extra levels and richer diagrams are stretch work after the full loop passes playtesting.
