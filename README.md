# MISSION CONTROL

Create a fictional space agency, fund an Earth-observation training contract, and unlock a research capability. The separate classic CubeSat tutorial lets you design a spacecraft, simulate six orbits, and compare a redesign. MISSION CONTROL is an independent educational game built with React, TypeScript, and Vite.

## Run locally

Use Node.js 24 and npm. From the project directory, run:

```sh
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), or the local URL printed by Vite.

## Test and build

```sh
npm test
npm run lint
npm run build
npm run preview
```

The build runs TypeScript checks and writes the static output to `dist/`. Preview serves that build at [http://localhost:4173](http://localhost:4173) by default.

The [Phase 0 implementation record](docs/PHASE_0.md) explains the training checks, local saves, and orbit references. To check the classic game manually, open **CubeSat tutorial**, select a brief, and confirm that an incompatible imager blocks launch. Correct the design, run the mission, redesign the same objective, and compare both results. The tutorial draft and previous attempt are session-only.

The orbit view is schematic. Parts, schedules and score weights are illustrative. The game can run without external services. See the in-game sources panel or the [source audit](docs/SOURCE_AUDIT.md) for the engineering references.
