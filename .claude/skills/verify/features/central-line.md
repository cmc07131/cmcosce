# Central line (perform: cvc)

## Sub-features

Twelve steps: position, pre-scan, scrub, prep and drape, kit, needle (lidocaine, aspiration, tip tracking), wire, confirm on ultrasound, nick and dilate, catheter, aspirate/flush/secure, X-ray. Each step has a goals panel (`data-testid="cvc-goals"`) and BACK A STEP / REDO THIS STEP.

## How to get to it (user POV)

Station `sx-central-line` → the manikin → "Demonstrate on the manikin". In the harness: `?kind=cvc`.

## Driving it with Playwright

`node scripts/verify/journeys/central-line.mjs`. Handles worth knowing:

- Pictures (viewBox): `cvc-tilt` 200×110, `cvc-rotate` 100×100, `cvc-scan`/`cvc-prep`/`cvc-needle`/`cvc-wire-field`/`cvc-dilate-field`/`cvc-cath-field`/`cvc-secure-field` 200×150, `cvc-us-scan`/`cvc-confirm` 240×160, `cvc-kit`/`cvc-after-tray` 200×110, `cvc-xray` 200×200.
- Strips (swipe): `cvc-feed`, `cvc-needle-out`, `cvc-dilator-pad`, `cvc-cath-pad`, `cvc-wire-pad`.
- Grip buttons: `cvc-grip-skin`, `cvc-grip-tail`. Holds: `cvc-press`, `cvc-gauze`. Dials: `.dial`.
- Needle step: read `.io-small` ("you see the tip" / "tip short of the beam") and alternate probe slides and needle advances until the note says "non-pulsatile".

## Gotchas

- Chlorhexidine dries in about 5 s of real time (30 s game time); the journey waits 5.6 s before draping.
- Garb buttons are disabled for 1.6 s while each animation plays.
- A review panel (`[data-review]`) after Next means the step's own check failed: the journey treats that as a failure.
