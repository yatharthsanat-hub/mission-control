# MISSION CONTROL 2.0 Phase 0

The default entry is Agency Headquarters. The linked classic CubeSat tutorial uses the original illustrative engine and regression suite. Run `npm run dev`, or run `npm run build` followed by `npm run preview`. Use Node.js 24. Run all tests with `npm test` and lint with `npm run lint`.

## Run the training contract

Choose a payload and one of two circular orbit presets. The regional agriculture team needs an imaging concept covering the reference red and near-infrared intervals and a calculated period within the fictional training limit. Inspect the source evidence, commit the training funds, then submit a review. A failed check preserves the commitment and can be revised. Acceptance settles the estimate, releases contingency and pays the grant once. Fund the pointing stability study and advance three program days to unlock `fine-pointing-adcs` eligibility. The unlock is a durable fleet capability flag for later assembly.

| Source used | Actual effect |
| --- | --- |
| NASA, [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf), slides 8, 13, 18–19 | The training review traces a named user's deliverable to explicit requirement checks and status. |
| [NASA Landsat 9](https://science.nasa.gov/mission/landsat-9/), OLI bands 4–5 | The original published intervals are preserved in µm and also represented in metres. Full coverage by a fictional rectangular response is required. |
| [JPL Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html), DE440 Earth row | The original 398600.435507 km³/s² value is converted by ×10⁹ and used for propagation and period acceptance. |

The concept review has no acquired imagery or real crop-health verdict. Finance, payload response, thresholds, program dates and orbit presets are gameplay inputs. All costs are scenario-year USD, denominated in integer cents. The ledger distinguishes cash, outstanding commitments, available cash and paid expenses. Command IDs and state checks prevent double posting.

## Saves

IndexedDB stores one active agency and a previous readable revision. Writes compare the exact previously read save in a single transaction before writing. A stale tab must reload to continue. Import is staged for explicit confirmation. Replacement archives the displaced data, and an unreadable active save exposes a raw download and previous-revision recovery when available. Export JSON files for portable backups. The checksum detects accidental damage. Decoding validates and replays bounded command history, including historical prerequisites. Schema 1 is the supported earlier Phase 0 envelope and gains model and source-registry revisions on migration. V1 has no persisted agency history.

## Solver and independent references

The pure TypeScript solver uses metres, seconds, radian angles and explicit Earth-centered J2000 axes. Epochs are TDB seconds from J2000, with finite inputs bounded to ±10¹⁰ s for arithmetic. Elapsed time is 0–86,400 s. Both apsides must be between 300 and 1,500 km above a scenario sphere of radius 6,371 km. Eccentricity is limited to [0, 0.3] in addition to the apsis bounds. Inclination is 0–π. Other angles use [0, 2π). The kernel returns Cartesian position, velocity and acceleration, period and provenance. The orbit plane remains inertial. Perturbations, Earth-fixed transforms, real weather, visibility and real ephemeris lookup are outside Phase 0.

Test references include a circular quarter-orbit case with a 90° inclination and an independently integrated ellipse. [The Python fixture generator](../tests/fixtures/generate_orbit_reference.py) integrates Cartesian state with RK4 and checks convergence at half the timestep. Its saved reference uses a 7,200 km semimajor axis, eccentricity 0.05, zero orientation angles, periapsis initial state and 4,321 s elapsed. The test compares each component within 0.01 m and 0.00001 m/s. Both paths use the same published constant by design. The solver remains **TESTED** under the [validation framework](SCIENTIFIC_VALIDATION.md).

For the pending [GMAT R2025a](https://software.nasa.gov/software/GSC-19468-1) cross-check, configure the identical Earth-centered MJ2000Eq Cartesian state from the fixture, with the fixture epoch converted explicitly from J2000 TDB. Disable drag, harmonics, SRP, third bodies and burns. Use Earth point-mass acceleration with documented DE440 μ, and verify the installed gravity constant rather than relying on defaults. Propagate 4,321 elapsed seconds and export Cartesian position and velocity in the configured frame. Record version, script, units, origin, epoch/time settings, numerical tolerances and converted reference values. Compare per-axis residuals at the agreed tolerance and retain the raw export. A matched GMAT run and independent reviewer signoff are pending.
