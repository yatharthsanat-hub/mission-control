# MISSION CONTROL 2.0 design system

Reviewed all ten supplied screenshots as visual references. Their on-screen copy, numeric readouts and branding are reference content for this review. Draw original artwork and layouts and source scientific values separately.

| Screenshot suffix | Observed structure | Proposed adaptation |
| --- | --- | --- |
| 155911 | Modular parts palette around a large assembly view | Searchable subsystem catalog beside a canvas with highlighted compatible sockets |
| 160051 | Trajectory view with mission clock and phase controls | Context header with body/frame, mission elapsed time and event selection |
| 160135 | Scenario and entity controls beside geometry and access intervals | Focused scenario editor and synchronized contact, eclipse and opportunity tracks |
| 160525 | Orbit and selected-object state with camera controls | Selected spacecraft state inspector, fit/orient actions and explicit view frame |
| 160557 | Close part inspection and compact resource and performance readouts | Inspect mount, axes, envelopes and relevant part data from the same assembly selection |
| 160633 | Fleet operations schedule and area-of-interest panel | Agency work queue and per-mission opportunity map tied to active requirements |
| 160801 | Moon-focused scene with reference-frame options and communications states | Body/vehicle camera focus and labeled ground acquisition/occultation events |
| 160823 | Globe-led navigation and task selection | A single mission context across the program portfolio and operations views |
| 160847 | Engineering overlay and spatial center markers | CoM and thrust-direction toggles with a compact engineering margin inspector |
| 160913 | Mission plan history and synchronized command lanes | Proposed/accepted/executed timeline lanes and replayable cause-and-effect |

## Workspace layout and components

Use a restrained ops console. An app header carries agency name, current mission and save state. Navigation moves between five workspaces. The active workspace displays one dominant task and one primary action. Diagnostics link to the failing field, part, or timestamp. Display telemetry and tables with units and precision appropriate to the model.

| Workspace | Composition and interactions |
| --- | --- |
| Headquarters | Portfolio list and selected contract summary. Cash, available funding and commitments share one ledger view. Research cards show cost, prerequisite and ready day. Save feedback appears near the agency name. |
| Assembly | Catalog rail, large canvas, engineering inspector. Pick or tab to a part, choose a compatible node, preview ghost with dimension axes, then confirm. Offer the same placement, rotation and removal commands through an assembly tree. Show undo/redo, fit-to-vehicle and reset-view controls. |
| Planning | Requirements checklist, orbit/ground track and margins. Click a constraint to see the orbit or part input and its provenance. Separate actions for forecast and committed flight. |
| Control | Central scene, event-driven telemetry inspector and time lanes for phase, sunlight, contacts, maneuver and payload. Show current cursor time, frame and run state. Clicking an event seeks to its recorded state. Projected command effects display as forecast. |
| Review | Requirement outcomes and one causal sequence near the top. Add data returned, power/propellant minima, ledger closeout and comparison against the preceding comparable mission. |

## Tokens and behavior

- Suggested surfaces use #0A111B (canvas shell), #111E2A (panel), #192A38 (selected surface), #324758 (border). Use #EAF4F5 for primary text and #A9BDCA for secondary. Use #74E7C2 for valid/primary action, #80CFFF for forecast and geometry, #FFD08A for warning, #FF9C9A for blocked. Use text and icons with color. Distinguish forecast and actual through line styles and labels. Check contrast against WCAG 2.2 AA in the built UI.
- Use Instrument Sans or Inter for controls and IBM Plex Mono for aligned telemetry values, with system fallbacks and local licensed fonts. Start at 16 px body, 14–16 px controls and units, with 12 px reserved for secondary labels. Use 8 px spacing increments and tabular numerals. Keep tables readable without tooltips or tiny overlays.
- Each quantitative output offers unit, model scope and a model status in its inspector. Separate provenance such as **Published input** or **Illustrative cost** from independent validation. Use named forecast/error states, and maintain visible focus during selection and validation.
- At wide widths use a flexible central viewport with collapsible rails and a bottom timeline. On tablets and phones place the main canvas above accessible Catalog, Inspector and Timeline sections. All required actions work via buttons, keyboard and touch, including no-drag placement, step and seek. Aim for 44 px touch targets. Use a reduced-motion option and a static fallback when WebGL or animation is unavailable. Preserve readings in text, avoid continuous live announcements, and announce meaningful state changes.
- Use procedural primitives or original low-poly assets for hardware. Use licensed body textures only after checking per-asset terms and attribution. Mark exaggerated spacecraft size and schematic geometry. Use a frame toggle and scale legend when rendering real model output. 3D projections, camera flight and play speed affect display only. Keep simulated time fixed at pause. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
