# MISSION CONTROL implementation plan

Begin application work after design approval. Use the existing React + TypeScript + Vite starter and ship a static browser build. Keep parts, briefs, orbit schedules and scoring constants in typed data. Put validation, simulation and scoring in pure TypeScript, with React rendering the draft design, committed run and prior result. Use grams for limit checks and watt-minutes for energy so the proposed values and reserve thresholds compare exactly. Calculate each complete run once so step playback and instant completion use identical telemetry.

## Prioritized milestones

| Priority and timebox | Deliverable and exit check |
| --- | --- |
| P0 · First 2–3 hours | Encode both briefs, the catalog and profiles. Build mass and budget validation, then the time-step engine and score. Verify battery and data conservation against a hand-worked orbit. Reproduce the coastal win and crop failure-to-success example below. |
| P0 · Day 1 | Connect briefing, builder, launch check, reserve choice, simulation, results and redesign. Use a plain telemetry timeline and a run-to-results control. Complete a full browser run, change one choice and see its effect in the comparison. |
| P1 · Early day 2 | Add bottleneck explanations, parts and profile previews, a sources and assumptions panel and accessible layout. Enumerate the small catalog, then ask first-time players to explain one trade-off and use the result to improve a design. Fix blockers and tune only where playtest evidence calls for it. |
| P1 · Final submission block | Run lint and the production build, deploy the static bundle, and complete a two-run walkthrough on the public URL. Prepare the demo and entry from the tested build. Leave time before the applicable deadline to verify public links and check portal fields. |

If time contracts, ship instant results with an event summary. Keep design, launch validation, telemetry, results and redesign intact before adding motion or richer diagrams.

## Acceptance checks

- **Launch checks.** Reject incompatible payloads and incomplete designs. Test mass and price exactly at their limits and one unit over. Show both violations when both apply and retain selections when returning to edit.
- **Energy.** Verify daylight charging, battery saturation, zero generation in eclipse, reserve-based action skips, housekeeping outages and daylight recovery. Assert battery charge always stays within usable capacity. Verify the displayed timeline and results agree on powered steps and minimum charge.
- **Data.** Verify target windows and daylight gating, no transmission outside a contact, empty-queue behavior, storage-full skips and partial scene downlink. Check that captured MB equals transmitted MB plus queued MB, and that only complete received scenes count. Verify both profiles and the end-of-run queue.
- **Balance and feedback.** Use body-mounted solar and a compact battery in all three cases below. The low-rate and high-rate choices must create distinct resource trade-offs. Check that excess science and headroom bonuses cap correctly, invalid launches receive no score, and a successful efficient build can beat a more expensive one. Use the same inputs twice and check that the result matches.

| Regression case | Expected result with proposed values |
| --- | --- |
| Coastal, mid-inclination, low-rate radio, 15% reserve | 3.30 kg and 73 credits. 7 complete scenes delivered, no outages. |
| Crop, near-polar, low-rate radio, 15% reserve | 3.70 kg and 89 credits. 6 complete scenes delivered, 8 storage-full skips, no outages. |
| Crop, near-polar, high-rate radio, change reserve from 15% to 35% | Both cost 98 credits and mass 4.00 kg. Delivered scenes change from 13 to 9, outage steps from 12 to zero. Mission status changes from failed to successful. |

- **Browser and accessibility.** Walk through the complete loop at phone and desktop widths and in two available browser engines. Verify keyboard-only operation, visible focus, basic screen reader labels, text equivalents for telemetry, clear status announcements and scrollable layouts. Run the production preview and repeat the run and redesign checks on the deployed URL in a signed-out session.

## Challenge and submission checklist

The [team challenge brief](../references/CHALLENGE.md) maps to the playable flow. The brief sets a measurement requirement, the builder and launch offer impose engineering constraints, the reserve policy gives the player an operations decision, and the mission run tests science return through the ground segment. The results and rerun let judges see the effect of a single change. Include a short Landsat 9 comparison in the source panel to connect the simulated measurements to real Earth observation. The [source audit](SOURCE_AUDIT.md#challenge-and-submission-verification) records the official challenge page access issue.

| Team submission requirement | Evidence to prepare |
| --- | --- |
| Name and 50–200 word summary | Use **MISSION CONTROL**. Explain the educational problem, intended audience, complete loop, and one visible trade-off. Verify the word count. |
| Public project link | Publish the Vite build as a static site. Test without login or a local server. |
| Public demo for Global Award eligibility | Record a gameplay capture of at most 30 seconds. Show the briefing, the crop run's power failure, the reserve change and the successful rerun. A deck of at most 7 slides is the fallback. Verify that the selected artifact opens without login. |
| Project details | Explain mechanics, educational impact, React/TypeScript/Vite, design choices, simplifications, and the tested build's actual features. |
| NASA and other resources | Use exact resource names and URLs from the audit and explain each material contribution. Credit CSA for inspiration if used and document permissions and attribution for any third-party assets. Use original visuals and independent project branding. |
| AI / Super Intelligence disclosure | Record AI help with this research, design and any eventual code and data development. Use original UI and direct gameplay capture for the demo. Under the local checklist, visibly watermark any SI-generated images or video used and acknowledge SI-generated audio in text or metadata. Keep NASA logos, flags, branding and mission identifiers out of AI-generated assets. |
| Final verification | Confirm the official 2026 challenge, submission fields, local deadlines and disclosure instructions in the Team Project tab. Verify public links, demo length, documented source use and an end-to-end deployed run before submission. [Team checklist](../references/SUBMISSION_REQUIREMENTS.md) · [2026 event page](https://www.spaceappschallenge.org/2026/) |
