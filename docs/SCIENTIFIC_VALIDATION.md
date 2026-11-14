# Scientific validation plan

The status applies to a versioned implementation and its documented scope. A reference equation or published property may be authoritative while the simulator that uses it still awaits validation. The [engineering models](V2_ENGINEERING_MODELS.md) define assumptions, units, proposed operating ranges and candidate reference cases.

| Status | Evidence required |
| --- | --- |
| VALIDATED | Independent calculation, benchmark, or data demonstrates a scoped implementation satisfies its recorded acceptance limits. Record tool/data versions, inputs, outputs, residuals and reviewer. |
| TESTED | Implementation and internal tests pass. Independent validation evidence is incomplete. |
| ILLUSTRATIVE | Exercises an educational relationship or game policy using fictional or approximate rules. Internal regression coverage can accompany this status. |
| NOT IMPLEMENTED | Specified or proposed capability. No corresponding V2 runtime. |

## Current inventory

Phase 0 implements Earth-centered point-mass gravity and bound Kepler propagation. Both are **TESTED**. The targets below still govern broader release validation.

| V2 model | Status | Independent reference and proposed acceptance |
| --- | --- | --- |
| Newtonian gravity, Earth only | TESTED | Analytic acceleration fixture and conservation checks pass. Compare broader conservative arcs to point-mass GMAT runs using the same μ. Initial target ≤1 m position and ≤1 mm/s velocity error over the scoped test arc. |
| Kepler elements and propagation, Earth only | TESTED | Inclined circular-quarter and independent Cartesian elliptic fixtures pass. Broader frame, propagation and GMAT checks remain open. |
| Visibility and frame conversion | NOT IMPLEMENTED | Compare matched spherical eclipse and station geometry with an independent script, targeting ≤1 s for resolved non-grazing transitions. Check site transforms and time conversions against pinned SPICE references. |
| Propulsion and delta-v | NOT IMPLEMENTED | Use an independent rocket-equation calculation, analytic Hohmann case and a GMAT impulse with identical frame, epoch and thrust/mass assumptions. Target ≤0.01 m/s delta-v planning error and ≤1 g propellant debit error on fixtures. Measure finite-burn error separately before deciding if the impulse envelope is adequate. |
| Mass and center of mass | NOT IMPLEMENTED | Hand weighted sum and independent CAD/spreadsheet comparison of a rotated, loaded assembly. Target ≤1 g mass and ≤0.1 mm CoM error on exact catalog geometry. |
| Electrical generation and battery storage | NOT IMPLEMENTED | Independent piecewise energy ledger with eclipse, incidence, rate limits, saturation, losses and unmet load. Target ≤0.1 J for exact constant-input fixtures. Compare to a measured or independently modeled duty cycle before broader subsystem claims. |
| Thermal balance | NOT IMPLEMENTED | Analytic equilibrium and independent ODE solver with a solar step and heater change. Target ≤0.5 K against a converged solution of the same lumped equation. A hardware-level temperature claim requires separate evidence. |
| Communications and link budget | NOT IMPLEMENTED | Hand FSPL and link worksheet with units and reference bandwidth; independently reproduce a mode switch and a lunar occultation. Initial targets ≤0.05 dB for a fixed link and ≤1 s for resolved geometric contacts. Compare with a published terminal/instrument case before any performance claim about actual hardware. |
| Attitude control and pointing | NOT IMPLEMENTED | Independent unit-vector and quaternion rotation fixtures, including 180°, ±q and commanded settling. Target ≤0.01° boresight error and ≤0.1 s for exact rate-cap benchmark. Scope is kinematic. Closed-loop behavior requires separate evidence. |
| Instrument performance | NOT IMPLEMENTED | Cross-check nadir pixel scale against the LROC published example and separately validate ray/sphere tests (nadir, tangent, miss). Target ≤1% for the sampling scale case. Compare tile area and data-size calculations against independent geometry/bit counts. |
| Launch constraints | NOT IMPLEMENTED | Independently read a candidate ICD and reconstruct fit, margin, interface and deployment tests. Verify at exact and over-limit values to the stored input precision. Until a cited offer is curated, use synthetic envelopes for implementation checks. |
| Phase 0 agency ledger and training estimate | ILLUSTRATIVE | Exact integer-cent reconciliation and transaction replay are tested. Rates and grants are scenario values. Later estimates can be compared to a work-package worksheet and dated scoped quotes. |

See the [Phase 0 implementation record](PHASE_0.md) for the exact solver scope, fixture generator, and GMAT comparison procedure. Lunar propagation and the other subsystem models remain planned.

V1 fixed windows, idealized resource model and score are **ILLUSTRATIVE**. The 12 passing legacy tests give implementation regression evidence. Their cases neither establish independent physical fidelity for V1 nor transfer a status to V2.

## Separate evidence tracks

1. **Implementation correctness.** Run unit, property and integration tests in Node using strict finite/unit-checked construction. Require byte-for-byte deterministic manifests/commands, stable event ordering, bounded precision for numeric outputs, checks for stale worker results, immutable replay and idempotent money events. Cover exact limits, negative/invalid values, zero mass, zero link rate, full/empty battery, NaN/Infinity, eclipse entry/exit, no-contact, partial receipt, fuel exhaustion, impact and event coincidence. Verify launch refuses out-of-range states. Use dimensional checks including km³/s² → m³/s² (×10⁹), Wh → J (×3,600), radians/degrees, and dBW/dBm (+30 from dBW to dBm).
2. **Scientific evidence.** Generate fixtures outside the app using an independent spreadsheet/script, published dataset or pinned tool. Match frame, origin, epoch/time scale, constants, body shape, solver/forces and units. Keep point-mass cross-tool agreement separate from model error against real trajectories. Compare predictions against higher-fidelity/observational references for proposed operational ranges. Document false passes/misses and narrow the scope or downgrade if the model diverges. A published GSD value validates only a specific sampling-scale check. Manufacturer inputs require exact revision and test conditions or an illustrative label.
3. **Integrated balance.** Check conservation of unforced two-body specific energy/angular momentum. Verify wet mass = dry + remaining propellant and impulse debits reconcile. Reconcile energy with solar, losses, load, curtailment and unmet demand. Check thermal energy against source minus emitted heat, queued bits + delivered bits against generated bits, and funds against originating ledger events. Compare at two finer maximum step sizes and split at discontinuities. Keep burn/impact events separate from conservation assertions.

Each fixture needs model and scenario IDs, provenance revision and checksum, complete initial state, reference command/config, expected data, units and absolute/relative tolerances fixed before evaluation. The independent record should include date, reviewer, measured discrepancies, effective input/duration envelope and findings. Freeze and rerun when a model, physical input, environment or algorithm changes. Require a second engineering review of scope before publishing a VALIDATED label. Show an explicit unevaluable state for missing data. A release with approximate models can describe their scope and evidence accurately. [NASA GMAT](https://software.nasa.gov/software/GSC-19468-1) · [JPL NAIF Frames](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html)
