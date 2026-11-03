# Ankle examination (station ot-ankle, a focused 3D examination)

## Sub-features

Look at both ankles; press along the posterior edge of each malleolus from 6 cm up to the tip (Ottawa); the base of the 5th metatarsal and the navicular; four steps; the proximal fibula; Simmonds' test (she turns face down, feet over the end of the couch, the calf squeezed); foot pulses and light touch.

## How to get to it (user POV)

Station `ot-ankle` → Ms Leung → "Examine". In the harness: `?exam=ot/ot-ankle`.

## Driving it with Playwright

`node scripts/verify/journeys/exam.mjs ot/ot-ankle`. Buttons are `exam3d-m-<focus entry>`, e.g. `exam3d-m-simmonds@calf-L`.

## Gotchas

- Simmonds' test is the only manoeuvre that turns her face down (posture `prone`); she rolls back at the end.
