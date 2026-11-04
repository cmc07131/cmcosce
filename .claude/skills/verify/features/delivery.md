# Normal delivery and third stage (perform: delivery)

## Sub-features

Two poses of one bench. The birth (`pose: birth`): hands on, crowning, cord, restitution, shoulders, baby. The third stage (`pose: third`): twin and oxytocin, cord clamping, separation, traction and membranes, placenta, tone/tears/loss. Each step has a goals panel (`birth-goals`, `third-goals`) and BACK A STEP / REDO THIS STEP, from the shared `src/game/bench/goals.tsx`.

## How to get to it (user POV)

Station `og-delivery` → the manikin → "Deliver the baby", then "Third stage". In the harness: `?kind=delivery&pose=birth` and `?kind=delivery&pose=third`.

## Driving it with Playwright

`node scripts/verify/journeys/delivery.mjs`. Handles worth knowing:

- Pictures (viewBox): `birth-work` 200×180 (the view from the foot), `birth-dry` 200×170, `third-work` 200×170 (abdomen, then the vulva), `third-cordpad` 200×100 (cord: x = 30 + cm × 156/50, y 62), `third-fundus` 200×170.
- Holds: `birth-flex` (through the contractions), `birth-feel`, `third-palpate`. Strips: `birth-loop` (swipe right); `birth-traction` (up and down, 40×150, middle at 75) and `third-traction` (down only, rest at 22); press and hold at a force with `pull()` in the journey. Dial: `.dial` (twist the membranes).
- Contractions run on a real clock: 3 s, then 10 s on and 5 s off. The crowning and the shoulders wait for them.

## Gotchas

- One mouse: press PANT first, then hold KEEP IT FLEXED.
- The third stage's clock runs in real time from 0:30 after the birth; clamp after 1:00 (LET 30 SECONDS PASS), and press WAIT A MINUTE until the note says something has changed (separation is 4 minutes after the oxytocin).
- A review panel (`[data-review]`) after Next means the step's own check failed: the journey treats that as a failure.
