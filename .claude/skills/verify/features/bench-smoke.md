# Every bench opens

## Sub-features

- Each `PROCEDURES` kind in `src/game/procedures.ts`, including the lazy 3D `positional` bench.

## How to get to it (user POV)

In a station, an action whose option has `perform: <kind>` opens the bench in a battle-style frame.

## Driving it with Playwright

`node scripts/verify/journeys/smoke.mjs`. It reads the list of kinds from the page (`window.__kinds`), opens each, waits (4 s for `positional`, which loads three.js and an FBX model), and fails on any page error or an empty page.

## Gotchas

- `positional` fetches `/models/patient/patient.fbx`; the harness serves the repo's `public/` folder for that.
- Benches not in `PROCEDURES` (`io`, `cico`, `cord`, `exam`, `pacing`, `igel`, `ventilator`, `defib`, `niv`) are opened by `Perform.tsx` directly and are not covered yet.
