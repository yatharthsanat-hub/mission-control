# Competition release · Pass 1

## Implementation plan

1. Open on Earth and lunar mission selection. Keep Headquarters linked for agency creation, research and funding. Use existing save and readiness gates. Route a ready agency to planning and explain the next prerequisite when a save, assembly or lunar research is missing.
2. Add a bounded Earth demo built with the existing assembly and mission approval functions. Use the standard flight console and a separate tab-local checkpoint. Keep its operations out of the agency save and ledger.
3. Apply a navy, slate, blue and amber design system to the mission workspaces. Rebuild the procedural render details around catalog bounds and actual attachment transforms. Preserve the inspectable assembly tree and viewport fallback.
4. Guide players from readiness and trade studies to commands and evidence. Use the existing numerical results for capture, storage, transmission and assessment displays. Preserve physical models and save formats.
5. Run the inherited and focused new tests, strict TypeScript, lint, static production build and browser walkthroughs. Record verification, remaining scope and the local commit.

Before this pass, players opened Headquarters, worked through agency systems, then discovered Earth and lunar planning. The intended release journey opens on a mission choice, directs players to the immediate prerequisite, and provides a separate demo path straight into a valid flight.

The local Phase 4 baseline is authoritative. The remote project pages were unavailable through the web tool. Earlier screenshot references were not used for this pass.

## Shipped in Pass 1

- The home page presents Earth Observation and Lunar Reconnaissance first. Each mission points to its next agency, research, assembly or planning step and can reopen a compatible approved flight. Agency Headquarters remains accessible for research, funding and saves. The classic illustrative CubeSat tutorial is available separately.
- Try Demo Mission opens an approved Earth crop-monitoring flight assembled and checked through the regular engineering and approval functions. It uses the same flight console, command validation and replay as agency missions. Its only persistent write is an independent browser-session checkpoint. The demo can succeed by acquiring and downlinking the required scenes, or fail when acquired scenes never reach the ground.
- The vehicle viewport uses catalog dimensions and engine-generated poses for the foiled bus, rails, solar cells, optical aperture, radio reflectors, battery ribs, pointing unit and structural spacer. Selection, placement previews and fit warnings are clearer. These are procedural representations of illustrative parts. The engineering envelope and assembly tree remain authoritative.
- Planning groups configuration, spacecraft and trajectory review, forecast, comparison, readiness and funding. Blocking findings appear first. Mission Control explains observation and downlink commands and shows recent activity and received data. Review highlights acquired scenes, complete scenes delivered and the mission target separately.
- The navy, slate, off-white, blue and amber palette is applied to the main mission journey. Success and error colors retain their operational meanings. The site still builds to a static Vite bundle with its existing deployment setup.

## Scientific status and art

Orbital and numerical kernels retain their existing TESTED status. Hardware and costs, environmental scenarios, service data rates and integrated game outcomes remain ILLUSTRATIVE. RF link margin and lunar landing safety remain NOT ASSESSED. Surface operations, additional flight destinations, synthesized science imagery and validated CAD are NOT IMPLEMENTED. This pass did not add a physical model or change an existing approval or save schema.

The landing-page photographs are locally bundled artwork. They do not enter mission calculations or represent observations acquired by the player. Earth is the NASA MODIS Blue Marble image and the Moon is the NASA/GSFC/Arizona State University LRO near-side mosaic. Both images link to their credits directly on the home page. [NASA Blue Marble 2002](https://science.nasa.gov/resource/blue-marble-2002/) · [NASA Lunar Near Side](https://science.nasa.gov/resource/lunar-near-side-2/)

## Remaining limitations

- The quick demo covers Earth crop monitoring. Lunar reconnaissance follows the regular agency, research and funding gates. The number of genuinely distinct instrument and spacecraft choices remains limited to the existing catalog.
- Spacecraft detail is procedural. The classic tutorial retains its original design. Vite reports the lazy 3D dependency chunk at about 934 kB minified and 247 kB gzip.
- No public deployment is part of Pass 1.

## Verification

- Node test suite passed 58 of 58 tests, including all 55 inherited tests and three new route, demo outcome and checkpoint tests.
- Strict TypeScript checks for the app and tooling, ESLint, Vite production build and Git whitespace checks passed.
- Headless Chrome ran the production bundle. The walkthrough covered a fresh landing, the two credited images, the demo at 360 px, a successful demo reload and a failed demo replay with downlink withheld. Headquarters still had no agency after the demo.
- The agency walkthrough created an account-free local agency, trained the program, unlocked pointing, assembled and saved a vehicle, compared lunar plans, and completed Earth and lunar flights. Both successful missions delivered two required scenes. A lunar flight without downlink acquired two scenes, delivered zero and exported an incomplete assessment. Success and incomplete records reproduced after reload or replay. The 3D camera responded to drag, and induced WebGL context loss switched to the 2D map. The 360 px fallback review stayed within the viewport.
- After Earth and two lunar approvals and multiple reloads or replays, the ledger showed unchanged expected balances of USD 385,000 cash, 384,100 committed, 900 available and 425,000 paid. The lunar grant appeared once.
