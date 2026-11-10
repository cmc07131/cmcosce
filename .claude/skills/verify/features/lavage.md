# Gastric lavage (perform: lavage)

## Sub-features

Seven steps: position (left lateral, foot up, suction), measure (mouth to epigastrium, tape), pass (spray, gag, lubricate, advance with her swallows), confirm (aspirate, air in and listen), siphon and sample, lavage (pour, funnel up to run in, down to drain, until 3 L and a clear return), finish (charcoal, pinch, withdraw, gag out). Goals panel `lavage-goals`, BACK A STEP / REDO THIS STEP.

## How to get to it (user POV)

Station `md-lavage` (medical gym) → the manikin → "Perform the lavage on the manikin". In the harness: `?kind=lavage`.

## Driving it with Playwright

`node scripts/verify/journeys/lavage.mjs`. Handles worth knowing:

- Strips (swipe, share of width × cm): `lavage-foot` (60 cm a width), `lavage-lay` (70), `lavage-advance` (30), `lavage-withdraw` (70, drag left).
- Holds: `lavage-spray`, `lavage-lube`, `lavage-aspirate`, `lavage-air`, `lavage-pour` (200 mL a second).
- The funnel strip `lavage-funnel` stays where you press it: top 32% runs in, bottom 32% drains. Pour with it in the middle, or it spills into the bucket.
- The bar reads `TUBE n CM`; the tally `lavage-tally` reads the volumes and whether the return is clear.

## Gotchas

- She gags at 14 cm: the tube stops for the rest of that drag. Press SWALLOW, then a new drag. A new drag while she gags is forcing.
- 15 aliquots of 200 mL; about 5 s each in real time.
- A review panel (`[data-review]`) after Next means the step's own check failed: the journey treats that as a failure.
