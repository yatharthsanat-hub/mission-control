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

## Pass 2 checklist

- Drive the six tutorial stages from spacecraft inspection, window navigation, real command playback and science delivery. Keep tutorial state separate from agency saves.
- Make finish availability and time controls explicit, with tests for required decisions and replay.
- Default Earth flights to a local geographic chart showing the target and actual modeled access. Keep the global view available.
- Refine the assembly silhouette within catalog bounds and label stowed and flight assumptions.
- Clarify navigation and independent planning choices, then verify both journeys and commit locally.

### Pass 2 implementation

- The guided Earth flight uses six stages. Inspect the mounted hardware, reach a forecast imaging window, arm imaging and step the run, then arm downlink and simulate a real contact. Review unlocks after one complete scene arrives. Finish mission applies the retained modes to the remaining five-second intervals. The full science requirement is evaluated at the end.
- Independent flights retain manual and armed modes, playback, stepping, and window controls. Finish is available after Start and can produce a failure. Its explanation states which intervals are simulated and that unused opportunities can be missed.
- The Earth chart is centered on the approved target coordinates. It shows a short body-fixed subpoint trace for the current or next modeled window, with the eligible segment distinguished from the approach. It never uses imagery as a science product. The optional Earth globe shows the orbit above the surface. The Moon retains its existing globe and map fallback.
- Assembly uses the same catalog bounds, stowed transforms and launch checks. The longer-looking optical barrel, antenna reflector and three-quarter camera are procedural. The flight power model assumes derated panel output in sunlight. No deployed dimensions, hinge dynamics or antenna gain come from the rendering.
- Independent users choose a spacecraft, objective, orbit, target, launch service and flight commands through the existing model. The coastal flood requirement still blocks approval with the existing red and near-infrared camera. No new science objective or sensor was added.
- Back to Missions checkpoints an in-progress flight and can save a changed assembly. Valid unapproved planning inputs can be restored in the originating tab. Approval acknowledgments and pinned comparisons are session UI state and need to be set again after leaving the planner. No persisted agency, mission or flight record schema changed.

### Pass 2 verification

- All 60 tests passed, including the 58 inherited tests. New cases exercised the six tutorial stages against the real flight engine, required a complete delivery before tutorial finish, and checked the independent and completed finish states and deterministic replay.
- Strict app and tooling TypeScript checks, ESLint, Vite production build and Git whitespace checks passed. Vite still warns about the size of the lazy 3D bundle.
- Chrome verified the fresh tutorial, checkpoint reload and restart, regional Earth chart and optional Earth globe, assembly saving via Back to Missions, recovery of an unapproved Earth plan, and successful Earth and lunar science. The lunar review also verified a failure when the radio stayed in standby, saved results and export, 3D context loss with map fallback, and a 360 px review.
- With an existing agency in the same browser tab, reopening and exiting the tutorial left cash, commitments, available funds and payments unchanged. Earth and lunar mission checkpoints replayed without duplicate financial entries.

## Pass 3 checklist

- Verify coordinate meanings and frame conventions. Derive local NASA basemap assets with recorded extent and keep the same projection for basemap and overlays.
- Verify globe texture orientation and retain the chart fallback.
- Add a visible-red wildfire context scenario with a fixed delivery deadline if it can pass the existing forecast and operation models. Keep old snapshots reproducible.
- Run geographic, scenario and inherited tests, then verify the static bundle in Chrome.
### Final Pass 3 scope

The guided Sacramento Valley tutorial, independent crop monitoring, lunar reconnaissance and lunar site review retain their established physics and agency save structure. The new California Wildfire Observation scenario and its six-hour forecast profile are versioned separately inside Earth mission schema 2. The app keeps the classic illustrative CubeSat tutorial available separately.

### Basemap and coordinate audit

- The regional and 3D Earth views bundle NASA Earth Observatory’s **Blue Marble: Next Generation**, July 2004 global base map. Reto Stöckli / NASA Goddard Space Flight Center produced the composite. The application credits NASA Earth Observatory alongside both views. NASA documents a north-up, equal-latitude/longitude Plate Carrée raster with WGS84 datum. The basemap is a historical composite, separate from the simulated scene counts. [NASA product and reuse credits](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) · [July download page](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/) · [Projection and extents](https://neo.gsfc.nasa.gov/archive/bluemarble/bmng/world_500m/readme.pdf) · [NASA Earth imagery reuse FAQ](https://science.nasa.gov/earth/faq/)
- Source JPEG: [5400 × 2700 global raster](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg), SHA-256 `f55226d46d27e05511f2118dc6aa24f5dbf9b6b2cddc87cc6e0e7dd067c00b11`. At 15 pixels per degree, the Western U.S. crop starts at column 600, row 570 and covers 140°W–100°W, 28°N–52°N. The Gulf crop starts at column 1050, row 735 and covers 110°W–70°W, 17°N–41°N. Both crops are 600 × 360. The globe raster is resampled to 2048 × 1024 with the full global extent. The three JPEGs total 368,809 bytes and load from the static bundle without remote calls.
- Sites store degrees north and east. Western longitudes are negative. The flight model uses an Earth-centered sphere, converts site degrees to radians once, and rotates inertial position into the synthetic fixed frame. A geographic subpoint uses fixed-vector longitude and latitude. The chart places imagery and overlay geometry inside the same rectangular SVG using the raster’s geographic extent. In 3D the fixed position `[x, y, z]` becomes scene `[x, z, -y]`. The Earth texture’s western edge sits on the 180° seam, Greenwich is at U=0.5, and north points along scene +Y. Tests check four named sites, a quarter-rotation fixture and actual Three.js geometry UVs. The spherical simulation reads the WGS84 map’s angular coordinates on its reference sphere and does not model ellipsoidal heights or historical Earth orientation.
- **Sacramento Valley — 38.58°N, 121.49°W.** A representative point at Sacramento for the existing 45 km training targeting radius. This point is neither the valley’s surveyed boundary nor its centroid. It was retained exactly. [USGS Sacramento coordinate reference, station 1155](https://pubs.usgs.gov/of/1977/0374/report.pdf)
- **Mississippi River Delta — 29.20°N, 89.30°W.** A representative lower-delta point for the existing 45 km radius. The modeled point was retained. USGS locates observations in the nearby active delta. NASA’s ASTER image provides regional context, and its malformed location text was excluded from the numerical audit. [USGS Pass a Loutre monitoring point](https://waterdata.usgs.gov/monitoring-location/USGS-291105089050000/) · [NASA ASTER delta context](https://science.nasa.gov/photojournal/mississippi-river-delta/)
- **Paradise, Butte County — 39.7596061°N, 121.6219177°W.** USGS GNIS primary point for Paradise. The 18 km targeting radius is a gameplay constraint centered on that point. It has no authority as a fire boundary or coverage measurement. [USGS GNIS 0277573](https://edits.nationalmap.gov/apps/gaz-domestic/public/summary/0277573)
- **Training terminal — 35°N, 106°W.** An illustrative point in central New Mexico, east of Albuquerque. USGS map graticules place it in the stated region. The site, elevation mask and service parameters describe a fictional station. The analysis retained its exact coordinates. Lunar communications continue to use the separate illustrative Earth-direction scenario. [USGS New Mexico grid map](https://pubs.usgs.gov/gp/0954a/report.pdf)

### California Wildfire Observation

The independent Earth mission asks for one daylight visible-red context scene near Paradise at 40 m/px or finer, completely delivered by T+06:00:00. The existing camera acquires its two red and near-infrared bands together. Only red is required for this objective. The fictional assignment draws geographic context from NASA’s reporting on the 2018 Camp Fire. It is not a reconstruction of that event. The reference orbit with the four standard subsystems opens one qualifying imaging window from T+04:57:20 to T+04:58:15. Contact from T+04:58:05 to T+05:04:05 can deliver the scene. The next potential contact is outside the deadline. At six hours the unchanged flight engine stops accepting orders. A stored scene receives no delivery credit. Approval still uses the existing one-time funding commitment and replays do not incur additional charges. [NASA Camp Fire regional context](https://science.nasa.gov/earth/earth-observatory/camp-fire-rages-in-california-144225/)

### Final science status and release limits

- **TESTED** · The existing orbital and geometry kernels, balance accounting and deterministic flight replay retain automated regression coverage. New tests check geographic alignment and wildfire deadlines.
- **ILLUSTRATIVE** · Hardware, costs, fixed mission epochs, target radii, power and communications service rates, and modeled scene collection. No satellite image pixels are generated. NASA imagery supplies geographic context.
- **NOT ASSESSED** · Real RF margin, real weather and smoke obscuration, live wildfire effects, and lunar landing safety.
- **NOT IMPLEMENTED** · Thermal fire detection, burn severity analysis, additional flight destinations and lunar landing. The current Earth camera cannot meet the independent coastal flood objective’s blue and green band requirements.
- Vite still reports a performance warning for the optional lazy 3D dependency bundle. The static production build was checked locally. Publication to Cloudflare Pages remains pending user review.

### Final verification

- All 63 tests passed, including the 60 inherited tests. Strict TypeScript checks for the app and tooling, ESLint, the production build and Git whitespace checks passed. A crop approval generated by the Pass 2 source imported and rebuilt exactly with its original funding commitment.
- Fresh Chrome completed all six tutorial stages, exercised the finish gate, resumed from a checkpoint and restarted. An existing agency’s financial balances also stayed unchanged after a tutorial visit. The three Blue Marble files decoded from the static build with no credentials. On desktop and at 360 px, the Sacramento marker aligned with the same pixel fraction of its basemap. The rendered regional view and textured globe both put the target inland of the California coast. The globe loaded its local JPEG.
- Chrome created an agency from the wildfire path, mounted and saved the four core spacecraft parts, inspected the camera and verified 3D orbit controls. The default forecast supported the requirements. The approved flight used the correct Paradise marker, succeeded when commands delivered the scene, and failed at six hours when imaging ran with the radio held. Both outcomes were checked after reload. Replay left one financial commitment. The 360 px review fit the viewport.
- Independently, Chrome completed crop monitoring and successful and incomplete lunar missions, checked spacecraft and mission draft recovery, exercised lunar 3D and WebGL fallback, exported and reopened site assessments, and verified exact ledger balances across reset and replay. The project was neither pushed nor deployed.
