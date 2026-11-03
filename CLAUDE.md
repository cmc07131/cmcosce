# OSCE Gym

A Pokémon Gold–style game for passing the HKCEM OSCE. Stations are JSON (`content/stations/<gym>/<id>.json`); hands-on procedures are benches (`src/game/<kind>/`, registered in `src/game/procedures.ts`, opened by a station option's `perform`). The user supplies sources; every clinical claim in a station is checked against them and recorded in its `notes`.

## Commands

- `npm run typecheck` and `npm test`: run both before every commit.
- `npm run verify`: plays the benches in a browser (see `.claude/skills/verify`). Run it after any change under `src/game/`.
- Deploys: Vercel builds `main`. Commit and push to `main`, as the history does.

## Rules and what enforces them

| Rule | Enforced by |
| --- | --- |
| Stations offer only the right lines and options; only the viva keeps distractors | `station.test.ts` "no wrong options anywhere" |
| Every station can be finished with full marks and no faults by its perfect script | `playthrough.test.ts` |
| Every key word of a station is said in its script | `station.test.ts` "perfect scripts" |
| Patient and relative lines carry Cantonese | `station.test.ts` "patient language" |
| Bedside checks are done at the patient, not said to the nurse | `station.test.ts` "bedside checks" |
| Flashcards: four distinct options, a source | `engine.test.ts` "flashcards" |
| Every bench opens without a page error | `scripts/verify/journeys/smoke.mjs` |
| A bench can be finished using only controls the player can see (labelled buttons, strips, dials, pictures); no step needs a hidden gesture | `scripts/verify/journeys/<bench>.mjs` (central line so far). It fails on the old needle-out drag that stranded players at the wire step |
| Each central line step says what it must achieve and how, and a correct step passes its own check | `src/game/cvc/steps.ts`, `cvc.test.ts`, and the central-line journey, which fails if a review opens |
| Benches offer no wrong-move buttons: mistakes come from doing a real action badly, never from picking a wrong button | Review only: no check yet |
| What the bench shows matches what is in the patient (the X-ray shows a retained wire; a carotid line crosses to the left) | `cvc.test.ts` |
| A focused 3D examination offers every manoeuvre it scores, and pressing each in turn finds every item | `scripts/verify/journeys/exam.mjs` (the hip and the ankle so far); `playthrough.test.ts` for the station script |

When the user corrects something, fix it and add its rule here, with the check that enforces it. A rule with no check that is broken a second time gets a check in the same change.

## Working on the user's computer

The user's checkout is on Windows (`C:\Users\qpzm6\OneDrive\Desktop\osce`) with `core.autocrlf`. When syncing it through the Linux device shell, run git as `git -c core.autocrlf=true …`, or every file looks modified. That shell cannot reach GitHub: bring commits across as a `git bundle`.
